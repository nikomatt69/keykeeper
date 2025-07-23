use crate::api_generator::ApiProvider;
use crate::llm_proxy::{LLMConfig, LLMRequest, process_with_llm};
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use reqwest;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::fs;

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
        }
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