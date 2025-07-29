use crate::api_generator::ApiProvider;
use crate::documentation_library::*;
use crate::ml_engine::MLEngine;
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiDocumentation {
    pub id: String,
    pub provider_id: String,
    pub title: String,
    pub url: String,
    pub content: String,
    pub sections: Vec<DocSection>,
    pub tags: Vec<String>,
    pub last_updated: DateTime<Utc>,
    pub version: Option<String>,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSection {
    pub id: String,
    pub title: String,
    pub content: String,
    pub level: u8,
    pub anchor: Option<String>,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocSearchResult {
    pub doc_id: String,
    pub section_id: Option<String>,
    pub title: String,
    pub snippet: String,
    pub url: String,
    pub relevance_score: f64,
    pub provider_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocIndexEntry {
    pub doc_id: String,
    pub provider_id: String,
    pub keywords: Vec<String>,
    pub content_hash: String,
    pub indexed_at: DateTime<Utc>,
}

pub struct DocumentationManager {
    client: reqwest::Client,
    index: HashMap<String, DocIndexEntry>,
    docs: HashMap<String, ApiDocumentation>,
    llm_proxy: Option<Arc<crate::llm_proxy::LLMProxyState>>,
    // New enhanced documentation library integration
    doc_library: Arc<DocumentationLibraryManager>,
    ml_engine: Option<Arc<MLEngine>>,
    chunk_size: usize,
    chunk_overlap: usize,
}

impl DocumentationManager {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("KeyKeeper-DocScraper/1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
            index: HashMap::new(),
            docs: HashMap::new(),
            llm_proxy: None,
            doc_library: Arc::new(DocumentationLibraryManager::new()),
            ml_engine: None,
            chunk_size: 1000,
            chunk_overlap: 200,
        }
    }

    pub fn new_with_llm_proxy(llm_proxy: Arc<crate::llm_proxy::LLMProxyState>) -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("KeyKeeper-DocScraper/1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
            index: HashMap::new(),
            docs: HashMap::new(),
            llm_proxy: Some(llm_proxy),
            doc_library: Arc::new(DocumentationLibraryManager::new()),
            ml_engine: None,
            chunk_size: 1000,
            chunk_overlap: 200,
        }
    }

    pub fn new_enhanced(
        llm_proxy: Option<Arc<crate::llm_proxy::LLMProxyState>>,
        ml_engine: Option<Arc<MLEngine>>,
    ) -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("KeyKeeper-DocScraper/1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
            index: HashMap::new(),
            docs: HashMap::new(),
            llm_proxy,
            doc_library: Arc::new(DocumentationLibraryManager::new()),
            ml_engine,
            chunk_size: 1000,
            chunk_overlap: 200,
        }
    }

    pub fn get_doc_library(&self) -> Arc<DocumentationLibraryManager> {
        Arc::clone(&self.doc_library)
    }

    /// Add documentation for an API provider
    pub async fn add_documentation(&mut self, provider: &ApiProvider, docs_url: &str) -> Result<ApiDocumentation> {
        let doc_id = format!("{}_{}", provider.id, chrono::Utc::now().timestamp());
        
        // Scrape documentation content
        let content = self.scrape_documentation_content(docs_url).await?;
        let sections = self.parse_content_sections(&content)?;
        
        let documentation = ApiDocumentation {
            id: doc_id.clone(),
            provider_id: provider.id.clone(),
            title: format!("{} Documentation", provider.name),
            url: docs_url.to_string(),
            content: content.clone(),
            sections,
            tags: vec!["api".to_string(), provider.category.clone()],
            last_updated: Utc::now(),
            version: None,
            language: "en".to_string(),
        };

        // Index the documentation
        self.index_documentation(&documentation).await?;
        
        // Store in memory
        self.docs.insert(doc_id.clone(), documentation.clone());
        
        Ok(documentation)
    }

    /// Get documentation for a specific provider
    pub fn get_provider_documentation(&self, provider_id: &str) -> Vec<&ApiDocumentation> {
        self.docs
            .values()
            .filter(|doc| doc.provider_id == provider_id)
            .collect()
    }

    /// Search documentation content
    pub fn search_documentation(&self, query: &str, provider_id: Option<&str>) -> Vec<DocSearchResult> {
        let mut results = Vec::new();
        let query_lower = query.to_lowercase();
        
        for doc in self.docs.values() {
            // Filter by provider if specified
            if let Some(pid) = provider_id {
                if doc.provider_id != pid {
                    continue;
                }
            }
            
            // Search in title
            if doc.title.to_lowercase().contains(&query_lower) {
                results.push(DocSearchResult {
                    doc_id: doc.id.clone(),
                    section_id: None,
                    title: doc.title.clone(),
                    snippet: self.extract_snippet(&doc.content, &query_lower, 200),
                    url: doc.url.clone(),
                    relevance_score: 0.9,
                    provider_id: doc.provider_id.clone(),
                });
            }
            
            // Search in sections
            for section in &doc.sections {
                if section.title.to_lowercase().contains(&query_lower) || 
                   section.content.to_lowercase().contains(&query_lower) {
                    results.push(DocSearchResult {
                        doc_id: doc.id.clone(),
                        section_id: Some(section.id.clone()),
                        title: format!("{} - {}", doc.title, section.title),
                        snippet: self.extract_snippet(&section.content, &query_lower, 150),
                        url: if let Some(anchor) = &section.anchor {
                            format!("{}#{}", doc.url, anchor)
                        } else {
                            doc.url.clone()
                        },
                        relevance_score: if section.title.to_lowercase().contains(&query_lower) { 0.8 } else { 0.6 },
                        provider_id: doc.provider_id.clone(),
                    });
                }
            }
        }
        
        // Sort by relevance score
        results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        results.truncate(20); // Limit to top 20 results
        
        results
    }

    /// Get documentation by ID
    pub fn get_documentation(&self, doc_id: &str) -> Option<&ApiDocumentation> {
        self.docs.get(doc_id)
    }

    /// Update documentation for a provider
    pub async fn update_documentation(&mut self, provider_id: &str, docs_url: &str) -> Result<()> {
        // Remove old documentation
        self.docs.retain(|_, doc| doc.provider_id != provider_id);
        self.index.retain(|_, entry| entry.provider_id != provider_id);
        
        // Create temporary provider for update
        let temp_provider = ApiProvider {
            id: provider_id.to_string(),
            name: provider_id.to_string(),
            description: String::new(),
            key_patterns: vec![],
            env_patterns: vec![],
            docs_url: docs_url.to_string(),
            setup_type: String::new(),
            category: String::new(),
            dependencies: vec![],
            config_templates: vec![],
        };
        
        // Add new documentation
        self.add_documentation(&temp_provider, docs_url).await?;
        
        Ok(())
    }

    /// Remove documentation for a provider
    pub fn remove_documentation(&mut self, provider_id: &str) -> Result<()> {
        self.docs.retain(|_, doc| doc.provider_id != provider_id);
        self.index.retain(|_, entry| entry.provider_id != provider_id);
        Ok(())
    }

    /// Get all indexed providers
    pub fn get_indexed_providers(&self) -> Vec<String> {
        self.docs
            .values()
            .map(|doc| doc.provider_id.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect()
    }

    // Private helper methods

    pub async fn scrape_documentation_content(&self, url: &str) -> Result<String> {
        let response = self.client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch documentation: {}", response.status()));
        }
        
        let html = response.text().await?;
        
        // Extract content synchronously to avoid Send issues
        let raw_content = {
            let document = Html::parse_document(&html);
            
            // Try common content selectors first (fallback approach)
            let content_selectors = [
                "main",
                ".content",
                "#content", 
                ".documentation",
                ".docs",
                "article",
                ".markdown-body",
                ".prose"
            ];
            
            let mut content = String::new();
            
            for selector_str in &content_selectors {
                if let Ok(selector) = Selector::parse(selector_str) {
                    if let Some(element) = document.select(&selector).next() {
                        content = element.text().collect::<Vec<_>>().join("\n");
                        break;
                    }
                }
            }
            
            // Fallback to body content if nothing found
            if content.is_empty() {
                if let Ok(selector) = Selector::parse("body") {
                    if let Some(element) = document.select(&selector).next() {
                        content = element.text().collect::<Vec<_>>().join("\n");
                    }
                }
            }
            
            content
        };
        
        if raw_content.is_empty() {
            return Err(anyhow!("Could not extract content from documentation"));
        }
        
        // TODO: Re-enable LLM enhancement after fixing State wrapper issue
        // Use LLM proxy to clean and improve content extraction if available
        // if let Some(llm_proxy) = &self.llm_proxy {
        //     match self.enhance_content_with_llm(&raw_content, url, llm_proxy).await {
        //         Ok(enhanced_content) => Ok(enhanced_content),
        //         Err(_) => Ok(raw_content), // Fallback to raw content if LLM fails
        //     }
        // } else {
        //     Ok(raw_content)
        // }
        
        Ok(raw_content)
    }

    // TODO: Implement LLM enhancement later when State wrapper is fixed
    // async fn enhance_content_with_llm(
    //     &self, 
    //     raw_content: &str, 
    //     url: &str,
    //     llm_proxy: &Arc<crate::llm_proxy::LLMProxyState>
    // ) -> Result<String> {
    //     // Implementation will be added later
    //     Ok(raw_content.to_string())
    // }

    fn parse_content_sections(&self, content: &str) -> Result<Vec<DocSection>> {
        let mut sections = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        let mut current_section: Option<DocSection> = None;
        let mut section_counter = 0;
        
        for line in lines {
            let trimmed = line.trim();
            
            // Detect headings (simplified markdown-style)
            if trimmed.starts_with('#') {
                // Save previous section
                if let Some(section) = current_section.take() {
                    sections.push(section);
                }
                
                let level = trimmed.chars().take_while(|&c| c == '#').count() as u8;
                let title = trimmed.trim_start_matches('#').trim().to_string();
                
                section_counter += 1;
                current_section = Some(DocSection {
                    id: format!("section_{}", section_counter),
                    title: title.clone(),
                    content: String::new(),
                    level,
                    anchor: Some(title.to_lowercase().replace(' ', "-")),
                    parent_id: None,
                });
            } else if !trimmed.is_empty() {
                // Add content to current section
                if let Some(ref mut section) = current_section {
                    if !section.content.is_empty() {
                        section.content.push('\n');
                    }
                    section.content.push_str(line);
                } else {
                    // Create intro section if no heading found yet
                    section_counter += 1;
                    current_section = Some(DocSection {
                        id: format!("section_{}", section_counter),
                        title: "Introduction".to_string(),
                        content: line.to_string(),
                        level: 1,
                        anchor: Some("introduction".to_string()),
                        parent_id: None,
                    });
                }
            }
        }
        
        // Add final section
        if let Some(section) = current_section {
            sections.push(section);
        }
        
        Ok(sections)
    }

    async fn index_documentation(&mut self, doc: &ApiDocumentation) -> Result<()> {
        let mut keywords = Vec::new();
        
        // Extract keywords from title
        keywords.extend(
            doc.title
                .to_lowercase()
                .split_whitespace()
                .map(|s| s.to_string())
        );
        
        // Extract keywords from sections
        for section in &doc.sections {
            keywords.extend(
                section.title
                    .to_lowercase()
                    .split_whitespace()
                    .map(|s| s.to_string())
            );
        }
        
        // Deduplicate keywords
        keywords.sort();
        keywords.dedup();
        
        let content_hash = format!("{:x}", md5::compute(&doc.content));
        
        let index_entry = DocIndexEntry {
            doc_id: doc.id.clone(),
            provider_id: doc.provider_id.clone(),
            keywords,
            content_hash,
            indexed_at: Utc::now(),
        };
        
        self.index.insert(doc.id.clone(), index_entry);
        
        Ok(())
    }

    /// Enhanced documentation processing with vector embeddings
    pub async fn add_documentation_enhanced(&self, provider: &ApiProvider, docs_url: &str) -> Result<String> {
        info!("Adding enhanced documentation for provider: {} from {}", provider.name, docs_url);
        
        // Scrape documentation content
        let content = self.scrape_documentation_content(docs_url).await?;
        
        // Create documentation library entry
        let library = DocumentationLibrary {
            id: String::new(), // Will be set by manager
            name: format!("{} Documentation", provider.name),
            description: format!("Official documentation for {} API", provider.name),
            provider_id: Some(provider.id.clone()),
            url: docs_url.to_string(),
            version: "latest".to_string(),
            language: "en".to_string(),
            tags: vec!["api".to_string(), provider.category.clone()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            content_hash: format!("{:x}", md5::compute(&content)),
            total_chunks: 0, // Will be updated after chunking
            status: DocumentationStatus::Processing,
        };
        
        // Add library to documentation manager
        let library_id = self.doc_library.add_library(library).await?;
        
        // Process content into chunks with embeddings
        self.process_content_into_chunks(&library_id, &content, provider).await?;
        
        info!("✅ Successfully processed documentation for {}", provider.name);
        Ok(library_id)
    }

    /// Process content into chunks and generate embeddings
    async fn process_content_into_chunks(&self, library_id: &str, content: &str, provider: &ApiProvider) -> Result<()> {
        debug!("Processing content into chunks for library: {}", library_id);
        
        // Split content into meaningful chunks
        let chunks = self.split_content_into_chunks(content)?;
        
        let mut chunk_index = 0;
        for chunk_content in chunks {
            if chunk_content.trim().is_empty() {
                continue;
            }
            
            // Generate embedding for this chunk
            let embedding = self.generate_chunk_embedding(&chunk_content).await?;
            
            // Extract metadata from chunk
            let metadata = self.extract_chunk_metadata(&chunk_content, chunk_index);
            
            // Determine section path from content
            let section_path = self.extract_section_path(&chunk_content);
            
            // Create documentation chunk
            let chunk = DocumentationChunk {
                id: String::new(), // Will be set by manager
                library_id: library_id.to_string(),
                chunk_index,
                title: self.extract_chunk_title(&chunk_content, &section_path),
                content: chunk_content,
                section_path,
                metadata,
                created_at: Utc::now(),
            };
            
            // Add chunk with embedding to library
            self.doc_library.add_chunk_with_embedding(
                chunk,
                embedding,
                "ml_engine_embedding".to_string(),
            ).await?;
            
            chunk_index += 1;
        }
        
        info!("Processed {} chunks for {}", chunk_index, provider.name);
        Ok(())
    }

    /// Split content into meaningful chunks
    fn split_content_into_chunks(&self, content: &str) -> Result<Vec<String>> {
        let mut chunks = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        
        let mut current_chunk = String::new();
        let mut current_size = 0;
        
        for line in lines {
            let line_size = line.len();
            
            // If adding this line would exceed chunk size and we have content
            if current_size + line_size > self.chunk_size && !current_chunk.is_empty() {
                // Look for a good break point in the last overlap_size characters
                let break_point = self.find_break_point(&current_chunk);
                
                if break_point > self.chunk_overlap {
                    chunks.push(current_chunk[..break_point].to_string());
                    current_chunk = current_chunk[break_point - self.chunk_overlap..].to_string();
                    current_size = current_chunk.len();
                } else {
                    chunks.push(current_chunk.clone());
                    current_chunk.clear();
                    current_size = 0;
                }
            }
            
            current_chunk.push_str(line);
            current_chunk.push('\n');
            current_size += line_size + 1;
        }
        
        // Add remaining content
        if !current_chunk.trim().is_empty() {
            chunks.push(current_chunk);
        }
        
        Ok(chunks)
    }

    /// Find a good break point for chunking (prefer sentence or paragraph breaks)
    fn find_break_point(&self, text: &str) -> usize {
        let text_bytes = text.as_bytes();
        let len = text_bytes.len();
        
        // Look for paragraph break (double newline)
        for i in (len.saturating_sub(200)..len).rev() {
            if i < len - 1 && text_bytes[i] == b'\n' && text_bytes[i + 1] == b'\n' {
                return i + 2;
            }
        }
        
        // Look for sentence break (period + space/newline)
        for i in (len.saturating_sub(200)..len).rev() {
            if i < len - 1 && text_bytes[i] == b'.' && 
               (text_bytes[i + 1] == b' ' || text_bytes[i + 1] == b'\n') {
                return i + 1;
            }
        }
        
        // Look for any newline
        for i in (len.saturating_sub(100)..len).rev() {
            if text_bytes[i] == b'\n' {
                return i + 1;
            }
        }
        
        // No good break point found, return full length
        len
    }

    /// Generate embedding for content chunk
    async fn generate_chunk_embedding(&self, content: &str) -> Result<Vec<f32>> {
        if let Some(ml_engine) = &self.ml_engine {
            // Try to generate embedding using ML engine
            match ml_engine.get_usage_stats().await {
                Ok(_) => {
                    // ML engine is available, but embedding generation not implemented yet
                    // For now, return a placeholder embedding based on content hash
                    warn!("ML engine embedding generation not fully implemented, using hash-based embedding");
                    Ok(self.generate_hash_based_embedding(content))
                }
                Err(_) => {
                    warn!("ML engine not available, using hash-based embedding");
                    Ok(self.generate_hash_based_embedding(content))
                }
            }
        } else {
            // Generate hash-based embedding as fallback
            Ok(self.generate_hash_based_embedding(content))
        }
    }

    /// Generate a deterministic embedding based on content hash (fallback)
    pub fn generate_hash_based_embedding(&self, content: &str) -> Vec<f32> {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        let hash = hasher.finish();
        
        // Generate a 384-dimensional embedding from hash
        let embedding_size = 384;
        let mut embedding = Vec::with_capacity(embedding_size);
        
        for i in 0..embedding_size {
            let seed = hash.wrapping_add(i as u64);
            let value = ((seed as f32 * 0.00001).sin() + 1.0) / 2.0;
            embedding.push(value);
        }
        
        // Normalize the embedding
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut embedding {
                *value /= norm;
            }
        }
        
        embedding
    }

    /// Extract metadata from chunk content
    fn extract_chunk_metadata(&self, content: &str, chunk_index: usize) -> ChunkMetadata {
        let word_count = content.split_whitespace().count();
        
        // Determine content type based on content analysis
        let content_type = if content.to_lowercase().contains("example") || 
                              content.contains("```") {
            ContentType::Example
        } else if content.to_lowercase().contains("tutorial") || 
                  content.to_lowercase().contains("getting started") {
            ContentType::Tutorial
        } else if content.to_lowercase().contains("config") || 
                  content.to_lowercase().contains("setup") {
            ContentType::Configuration
        } else if content.to_lowercase().contains("error") || 
                  content.to_lowercase().contains("troubleshoot") {
            ContentType::Troubleshooting
        } else if content.to_lowercase().contains("api reference") || 
                  content.to_lowercase().contains("endpoint") {
            ContentType::Reference
        } else {
            ContentType::Overview
        };
        
        // Extract keywords (simple implementation)
        let keywords = content
            .split_whitespace()
            .filter(|word| word.len() > 3)
            .filter(|word| !["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "she", "use", "your", "from", "they", "know", "want", "been", "good", "much", "some", "time", "very", "when", "come", "here", "just", "like", "long", "make", "many", "over", "such", "take", "than", "them", "well", "were"].contains(&word.to_lowercase().as_str()))
            .take(10)
            .map(|s| s.to_lowercase())
            .collect();
        
        // Calculate importance score based on content characteristics
        let importance_score = if content.contains("important") || content.contains("note") {
            0.9
        } else if content.contains("example") || content.contains("```") {
            0.8
        } else if word_count > 100 {
            0.7
        } else {
            0.5
        };
        
        ChunkMetadata {
            word_count,
            content_type,
            importance_score,
            keywords,
            related_chunks: Vec::new(), // Would be calculated after all chunks are processed
            source_url: None,
            line_numbers: None,
        }
    }

    /// Extract section path from content (hierarchical navigation)
    fn extract_section_path(&self, content: &str) -> Vec<String> {
        let mut path = Vec::new();
        
        // Look for markdown-style headers
        let lines: Vec<&str> = content.lines().take(10).collect(); // Check first 10 lines
        
        for line in lines {
            if line.starts_with('#') {
                let level = line.chars().take_while(|&c| c == '#').count();
                let title = line.trim_start_matches('#').trim();
                
                if !title.is_empty() {
                    // Truncate path to current level and add new section
                    path.truncate(level.saturating_sub(1));
                    path.push(title.to_string());
                    break;
                }
            }
        }
        
        // If no headers found, try to extract from first non-empty line
        if path.is_empty() {
            if let Some(first_line) = content.lines().find(|line| !line.trim().is_empty()) {
                let words: Vec<&str> = first_line.split_whitespace().take(5).collect();
                if !words.is_empty() {
                    path.push(words.join(" "));
                }
            }
        }
        
        // Ensure we have at least one section
        if path.is_empty() {
            path.push("General".to_string());
        }
        
        path
    }

    /// Extract title from chunk content
    fn extract_chunk_title(&self, content: &str, section_path: &[String]) -> String {
        // Try to find a title in the content
        for line in content.lines().take(5) {
            let trimmed = line.trim();
            
            // Check for markdown headers
            if trimmed.starts_with('#') {
                let title = trimmed.trim_start_matches('#').trim();
                if !title.is_empty() && title.len() < 100 {
                    return title.to_string();
                }
            }
            
            // Check for lines that look like titles (short, no punctuation at end)
            if trimmed.len() > 5 && trimmed.len() < 80 && 
               !trimmed.ends_with('.') && !trimmed.ends_with('!') && 
               !trimmed.ends_with('?') && !trimmed.contains("```") {
                return trimmed.to_string();
            }
        }
        
        // Fall back to section path
        if !section_path.is_empty() {
            return section_path.last().unwrap().clone();
        }
        
        // Final fallback
        "Documentation Section".to_string()
    }

    /// Search documentation using enhanced vector search
    pub async fn search_documentation_enhanced(
        &self,
        query: &str,
        provider_id: Option<&str>,
        content_types: Option<Vec<ContentType>>,
        max_results: Option<usize>,
    ) -> Result<Vec<DocumentationSearchResult>> {
        debug!("Enhanced documentation search for: {}", query);
        
        // Generate query embedding
        let query_embedding = self.generate_chunk_embedding(query).await?;
        
        // Build search parameters
        let library_ids = if let Some(provider_id) = provider_id {
            let libraries = self.doc_library.get_libraries_by_provider(provider_id).await?;
            Some(libraries.into_iter().map(|lib| lib.id).collect())
        } else {
            None
        };
        
        let search_params = VectorSearchParams {
            query: query.to_string(),
            library_ids,
            content_types,
            min_similarity: 0.6, // Lower threshold for broader results
            max_results: max_results.unwrap_or(10),
            include_metadata: true,
            boost_recent: true,
            section_filter: None,
        };
        
        // Perform vector search
        let results = self.doc_library.vector_search(search_params, query_embedding).await?;
        
        info!("Enhanced search found {} results for query: {}", results.len(), query);
        Ok(results)
    }

    /// Get documentation library statistics
    pub async fn get_library_statistics(&self) -> Result<HashMap<String, usize>> {
        self.doc_library.get_library_stats().await
    }

    fn extract_snippet(&self, content: &str, query: &str, max_length: usize) -> String {
        let content_lower = content.to_lowercase();
        
        if let Some(pos) = content_lower.find(query) {
            let start = pos.saturating_sub(max_length / 2);
            let end = std::cmp::min(start + max_length, content.len());
            
            let mut snippet = content[start..end].to_string();
            
            // Clean up snippet
            if start > 0 {
                snippet = format!("...{}", snippet);
            }
            if end < content.len() {
                snippet = format!("{}...", snippet);
            }
            
            snippet
        } else {
            content.chars().take(max_length).collect::<String>() + 
            if content.len() > max_length { "..." } else { "" }
        }
    }
}