use crate::enhanced_types::{EnhancedConfigTemplate, TemplateFile, FrameworkCompatibility};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use tracing::{debug, info, warn};

/// Template inheritance resolver for handling template extension and overrides
pub struct TemplateInheritanceResolver {
    /// Cache of resolved templates
    template_cache: HashMap<String, EnhancedConfigTemplate>,
    /// Registry of base templates
    base_templates: HashMap<String, EnhancedConfigTemplate>,
}

/// Template resolution context
#[derive(Debug, Clone)]
pub struct ResolutionContext {
    /// Stack of templates being resolved (to detect circular dependencies)
    resolution_stack: Vec<String>,
    /// Override values from child templates
    overrides: HashMap<String, Value>,
    /// Framework-specific overrides
    framework_overrides: HashMap<String, HashMap<String, Value>>,
}

/// Template merge strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeStrategy {
    /// Replace the entire value
    Replace,
    /// Merge arrays by appending
    AppendArray,
    /// Merge arrays by prepending
    PrependArray,
    /// Merge objects deeply
    MergeDeep,
    /// Keep only unique values in arrays
    UniqueArray,
}

/// Template inheritance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InheritanceConfig {
    /// Fields that should be merged rather than replaced
    pub merge_fields: HashMap<String, MergeStrategy>,
    /// Fields that should never be inherited
    pub exclude_fields: HashSet<String>,
    /// Maximum depth of inheritance chain
    pub max_inheritance_depth: usize,
}

impl Default for InheritanceConfig {
    fn default() -> Self {
        let mut merge_fields = HashMap::new();
        merge_fields.insert("template_files".to_string(), MergeStrategy::AppendArray);
        merge_fields.insert("dependencies".to_string(), MergeStrategy::UniqueArray);
        merge_fields.insert("dev_dependencies".to_string(), MergeStrategy::UniqueArray);
        merge_fields.insert("peer_dependencies".to_string(), MergeStrategy::UniqueArray);
        merge_fields.insert("setup_instructions".to_string(), MergeStrategy::AppendArray);
        merge_fields.insert("usage_examples".to_string(), MergeStrategy::AppendArray);
        merge_fields.insert("next_steps".to_string(), MergeStrategy::AppendArray);
        merge_fields.insert("framework_compatibility".to_string(), MergeStrategy::MergeDeep);
        merge_fields.insert("validation_rules".to_string(), MergeStrategy::AppendArray);
        merge_fields.insert("tags".to_string(), MergeStrategy::UniqueArray);
        merge_fields.insert("documentation_links".to_string(), MergeStrategy::AppendArray);

        let mut exclude_fields = HashSet::new();
        exclude_fields.insert("id".to_string());
        exclude_fields.insert("extends".to_string());

        Self {
            merge_fields,
            exclude_fields,
            max_inheritance_depth: 10,
        }
    }
}

impl TemplateInheritanceResolver {
    /// Create a new template inheritance resolver
    pub fn new() -> Self {
        Self {
            template_cache: HashMap::new(),
            base_templates: HashMap::new(),
        }
    }

    /// Register a base template that can be extended by others
    pub fn register_base_template(&mut self, template: EnhancedConfigTemplate) {
        debug!("Registering base template: {}", template.id);
        self.base_templates.insert(template.id.clone(), template);
    }

    /// Register multiple base templates
    pub fn register_base_templates(&mut self, templates: Vec<EnhancedConfigTemplate>) {
        for template in templates {
            self.register_base_template(template);
        }
    }

    /// Resolve a template with inheritance, applying all parent templates
    pub fn resolve_template(
        &mut self,
        template: &EnhancedConfigTemplate,
        config: &InheritanceConfig,
    ) -> Result<EnhancedConfigTemplate> {
        // Check cache first
        if let Some(cached) = self.template_cache.get(&template.id) {
            return Ok(cached.clone());
        }

        let mut context = ResolutionContext {
            resolution_stack: Vec::new(),
            overrides: template.overrides.clone(),
            framework_overrides: HashMap::new(),
        };

        let resolved = self.resolve_template_recursive(template, config, &mut context)?;
        
        // Cache the resolved template
        self.template_cache.insert(template.id.clone(), resolved.clone());
        
        Ok(resolved)
    }

    /// Recursively resolve template inheritance
    fn resolve_template_recursive(
        &self,
        template: &EnhancedConfigTemplate,
        config: &InheritanceConfig,
        context: &mut ResolutionContext,
    ) -> Result<EnhancedConfigTemplate> {
        // Check for circular dependency
        if context.resolution_stack.contains(&template.id) {
            return Err(anyhow::anyhow!(
                "Circular template inheritance detected: {} -> {}",
                context.resolution_stack.join(" -> "),
                template.id
            ));
        }

        // Check inheritance depth
        if context.resolution_stack.len() >= config.max_inheritance_depth {
            return Err(anyhow::anyhow!(
                "Maximum template inheritance depth ({}) exceeded",
                config.max_inheritance_depth
            ));
        }

        context.resolution_stack.push(template.id.clone());

        let resolved = if let Some(parent_id) = &template.extends {
            // Find parent template
            let parent_template = self.base_templates
                .get(parent_id)
                .ok_or_else(|| anyhow::anyhow!("Parent template '{}' not found", parent_id))?;

            // Resolve parent first
            let resolved_parent = self.resolve_template_recursive(parent_template, config, context)?;
            
            // Merge child template with resolved parent
            self.merge_templates(&resolved_parent, template, config)?
        } else {
            // No parent, return template as-is (but apply any framework-specific overrides)
            self.apply_framework_overrides(template.clone(), context)?
        };

        context.resolution_stack.pop();
        Ok(resolved)
    }

    /// Merge child template with parent template
    fn merge_templates(
        &self,
        parent: &EnhancedConfigTemplate,
        child: &EnhancedConfigTemplate,
        config: &InheritanceConfig,
    ) -> Result<EnhancedConfigTemplate> {
        let mut merged = parent.clone();

        // Override basic fields from child
        merged.id = child.id.clone();
        merged.name = child.name.clone();
        merged.description = child.description.clone();
        merged.version = child.version.clone();

        // Merge provider information
        if !child.provider_id.is_empty() {
            merged.provider_id = child.provider_id.clone();
        }
        if !child.provider_name.is_empty() {
            merged.provider_name = child.provider_name.clone();
        }
        if !child.provider_category.is_empty() {
            merged.provider_category = child.provider_category.clone();
        }

        // Merge template files
        merged.template_files = self.merge_template_files(&parent.template_files, &child.template_files)?;

        // Merge framework compatibility
        merged.framework_compatibility = self.merge_framework_compatibility(
            &parent.framework_compatibility,
            &child.framework_compatibility,
        )?;

        // Merge environment variables
        merged.required_env_vars = self.merge_string_vec(
            &parent.required_env_vars,
            &child.required_env_vars,
            &MergeStrategy::UniqueArray,
        );
        merged.optional_env_vars = self.merge_string_vec(
            &parent.optional_env_vars,
            &child.optional_env_vars,
            &MergeStrategy::UniqueArray,
        );
        
        // Merge env var descriptions
        merged.env_var_descriptions = self.merge_hashmap(
            &parent.env_var_descriptions,
            &child.env_var_descriptions,
        );

        // Merge dependencies
        merged.dependencies = self.merge_string_vec(
            &parent.dependencies,
            &child.dependencies,
            &MergeStrategy::UniqueArray,
        );
        merged.dev_dependencies = self.merge_string_vec(
            &parent.dev_dependencies,
            &child.dev_dependencies,
            &MergeStrategy::UniqueArray,
        );
        merged.peer_dependencies = self.merge_string_vec(
            &parent.peer_dependencies,
            &child.peer_dependencies,
            &MergeStrategy::UniqueArray,
        );

        // Merge features
        merged.supported_features = self.merge_string_vec(
            &parent.supported_features,
            &child.supported_features,
            &MergeStrategy::UniqueArray,
        );
        merged.feature_combinations = self.merge_feature_combinations(
            &parent.feature_combinations,
            &child.feature_combinations,
        );

        // Merge instructions and examples
        merged.setup_instructions = self.merge_string_vec(
            &parent.setup_instructions,
            &child.setup_instructions,
            &MergeStrategy::AppendArray,
        );
        merged.usage_examples = self.merge_usage_examples(
            &parent.usage_examples,
            &child.usage_examples,
        );
        merged.next_steps = self.merge_string_vec(
            &parent.next_steps,
            &child.next_steps,
            &MergeStrategy::AppendArray,
        );

        // Merge metadata
        merged.tags = self.merge_string_vec(&parent.tags, &child.tags, &MergeStrategy::UniqueArray);
        merged.documentation_links = self.merge_documentation_links(
            &parent.documentation_links,
            &child.documentation_links,
        );

        // Override scalar fields from child if they're not empty/default
        if !child.difficulty_level.is_empty() && child.difficulty_level != "beginner" {
            merged.difficulty_level = child.difficulty_level.clone();
        }
        if !child.estimated_setup_time.is_empty() {
            merged.estimated_setup_time = child.estimated_setup_time.clone();
        }

        // Merge validation rules
        merged.validation_rules = self.merge_validation_rules(
            &parent.validation_rules,
            &child.validation_rules,
        );

        // Merge LLM context
        if child.llm_context.is_some() {
            merged.llm_context = child.llm_context.clone();
        }

        // Apply child-specific overrides
        merged.overrides = child.overrides.clone();

        Ok(merged)
    }

    /// Merge template files, handling duplicates and dependencies
    fn merge_template_files(
        &self,
        parent_files: &[TemplateFile],
        child_files: &[TemplateFile],
    ) -> Result<Vec<TemplateFile>> {
        let mut merged_files = HashMap::new();
        
        // Add parent files first
        for file in parent_files {
            merged_files.insert(file.id.clone(), file.clone());
        }

        // Override/add child files
        for file in child_files {
            if let Some(existing) = merged_files.get(&file.id) {
                // Merge file properties
                let mut merged_file = existing.clone();
                
                // Override basic properties
                merged_file.name = file.name.clone();
                merged_file.description = file.description.clone();
                merged_file.file_type = file.file_type.clone();
                merged_file.file_path = file.file_path.clone();
                merged_file.template_content = file.template_content.clone();
                merged_file.language = file.language.clone();
                merged_file.category = file.category.clone();
                
                // Merge dependencies
                let mut deps = existing.dependencies.clone();
                deps.extend(file.dependencies.clone());
                deps.sort();
                deps.dedup();
                merged_file.dependencies = deps;

                // Merge framework variants
                for (framework, content) in &file.framework_variants {
                    merged_file.framework_variants.insert(framework.clone(), content.clone());
                }

                // Merge conditions
                let mut conditions = existing.conditions.clone();
                conditions.extend(file.conditions.clone());
                conditions.sort();
                conditions.dedup();
                merged_file.conditions = conditions;

                merged_files.insert(file.id.clone(), merged_file);
            } else {
                merged_files.insert(file.id.clone(), file.clone());
            }
        }

        // Convert back to vector and sort by priority
        let mut result: Vec<TemplateFile> = merged_files.into_values().collect();
        result.sort_by(|a, b| b.priority.cmp(&a.priority)); // Higher priority first
        
        Ok(result)
    }

    /// Merge framework compatibility information
    fn merge_framework_compatibility(
        &self,
        parent_compat: &[FrameworkCompatibility],
        child_compat: &[FrameworkCompatibility],
    ) -> Result<Vec<FrameworkCompatibility>> {
        let mut merged_compat = HashMap::new();

        // Add parent compatibility
        for compat in parent_compat {
            merged_compat.insert(compat.framework.clone(), compat.clone());
        }

        // Override/add child compatibility
        for compat in child_compat {
            merged_compat.insert(compat.framework.clone(), compat.clone());
        }

        Ok(merged_compat.into_values().collect())
    }

    /// Merge string vectors based on strategy
    fn merge_string_vec(
        &self,
        parent: &[String],
        child: &[String],
        strategy: &MergeStrategy,
    ) -> Vec<String> {
        match strategy {
            MergeStrategy::Replace => child.to_vec(),
            MergeStrategy::AppendArray => {
                let mut result = parent.to_vec();
                result.extend(child.iter().cloned());
                result
            },
            MergeStrategy::PrependArray => {
                let mut result = child.to_vec();
                result.extend(parent.iter().cloned());
                result
            },
            MergeStrategy::UniqueArray => {
                let mut result = parent.to_vec();
                result.extend(child.iter().cloned());
                result.sort();
                result.dedup();
                result
            },
            _ => child.to_vec(), // Default to replace
        }
    }

    /// Merge HashMaps
    fn merge_hashmap<V: Clone>(
        &self,
        parent: &HashMap<String, V>,
        child: &HashMap<String, V>,
    ) -> HashMap<String, V> {
        let mut result = parent.clone();
        result.extend(child.iter().map(|(k, v)| (k.clone(), v.clone())));
        result
    }

    /// Merge feature combinations
    fn merge_feature_combinations(
        &self,
        parent: &HashMap<String, Vec<String>>,
        child: &HashMap<String, Vec<String>>,
    ) -> HashMap<String, Vec<String>> {
        let mut result = parent.clone();
        
        for (feature, combinations) in child {
            if let Some(existing) = result.get_mut(feature) {
                existing.extend(combinations.iter().cloned());
                existing.sort();
                existing.dedup();
            } else {
                result.insert(feature.clone(), combinations.clone());
            }
        }
        
        result
    }

    /// Merge usage examples
    fn merge_usage_examples(
        &self,
        parent: &[crate::enhanced_types::CodeExample],
        child: &[crate::enhanced_types::CodeExample],
    ) -> Vec<crate::enhanced_types::CodeExample> {
        let mut result = parent.to_vec();
        result.extend(child.iter().cloned());
        result
    }

    /// Merge documentation links
    fn merge_documentation_links(
        &self,
        parent: &[crate::enhanced_types::DocumentationLink],
        child: &[crate::enhanced_types::DocumentationLink],
    ) -> Vec<crate::enhanced_types::DocumentationLink> {
        let mut result = parent.to_vec();
        result.extend(child.iter().cloned());
        result
    }

    /// Merge validation rules
    fn merge_validation_rules(
        &self,
        parent: &[crate::enhanced_types::ValidationRule],
        child: &[crate::enhanced_types::ValidationRule],
    ) -> Vec<crate::enhanced_types::ValidationRule> {
        let mut result = parent.to_vec();
        result.extend(child.iter().cloned());
        result
    }

    /// Apply framework-specific overrides
    fn apply_framework_overrides(
        &self,
        mut template: EnhancedConfigTemplate,
        _context: &ResolutionContext,
    ) -> Result<EnhancedConfigTemplate> {
        // Apply any framework-specific overrides from context
        // This is where you would apply framework-specific template modifications
        
        Ok(template)
    }

    /// Clear the template cache
    pub fn clear_cache(&mut self) {
        self.template_cache.clear();
    }

    /// Get template resolution tree for debugging
    pub fn get_resolution_tree(&self, template_id: &str) -> Option<TemplateResolutionTree> {
        self.build_resolution_tree(template_id, &mut HashSet::new())
    }

    /// Build template resolution tree
    fn build_resolution_tree(
        &self,
        template_id: &str,
        visited: &mut HashSet<String>,
    ) -> Option<TemplateResolutionTree> {
        if visited.contains(template_id) {
            return None; // Circular dependency
        }
        
        visited.insert(template_id.to_string());
        
        let template = self.base_templates.get(template_id)?;
        let mut tree = TemplateResolutionTree {
            template_id: template_id.to_string(),
            template_name: template.name.clone(),
            parent: None,
            children: Vec::new(),
        };

        if let Some(parent_id) = &template.extends {
            tree.parent = self.build_resolution_tree(parent_id, visited).map(Box::new);
        }

        // Find children
        for (id, tmpl) in &self.base_templates {
            if let Some(parent_id) = &tmpl.extends {
                if parent_id == template_id {
                    if let Some(child_tree) = self.build_resolution_tree(id, visited) {
                        tree.children.push(child_tree);
                    }
                }
            }
        }

        visited.remove(template_id);
        Some(tree)
    }
}

/// Template resolution tree for debugging and visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateResolutionTree {
    pub template_id: String,
    pub template_name: String,
    pub parent: Option<Box<TemplateResolutionTree>>,
    pub children: Vec<TemplateResolutionTree>,
}

impl Default for TemplateInheritanceResolver {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enhanced_types::{TemplateFile, UserPreferences};

    #[test]
    fn test_template_inheritance_resolution() {
        let mut resolver = TemplateInheritanceResolver::new();
        let config = InheritanceConfig::default();

        // Create base template
        let base_template = EnhancedConfigTemplate {
            id: "base-auth".to_string(),
            name: "Base Auth Template".to_string(),
            description: "Base authentication template".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            provider_id: "auth".to_string(),
            provider_name: "Authentication".to_string(),
            provider_category: "auth".to_string(),
            template_files: vec![
                TemplateFile {
                    id: "base-config".to_string(),
                    name: "Base Config".to_string(),
                    description: "Base configuration".to_string(),
                    file_type: "typescript".to_string(),
                    file_path: "lib/auth-base.ts".to_string(),
                    template_content: "// Base auth config".to_string(),
                    language: "typescript".to_string(),
                    is_required: true,
                    dependencies: vec!["base-dep".to_string()],
                    framework_variants: HashMap::new(),
                    conditions: vec![],
                    category: "config".to_string(),
                    priority: 100,
                }
            ],
            framework_compatibility: vec![],
            required_env_vars: vec!["BASE_SECRET".to_string()],
            optional_env_vars: vec![],
            env_var_descriptions: HashMap::new(),
            dependencies: vec!["base-package".to_string()],
            dev_dependencies: vec![],
            peer_dependencies: vec![],
            extends: None,
            overrides: HashMap::new(),
            supported_features: vec!["basic-auth".to_string()],
            feature_combinations: HashMap::new(),
            setup_instructions: vec!["Install base auth".to_string()],
            usage_examples: vec![],
            next_steps: vec!["Configure base auth".to_string()],
            tags: vec!["auth".to_string()],
            difficulty_level: "beginner".to_string(),
            estimated_setup_time: "5 minutes".to_string(),
            documentation_links: vec![],
            validation_rules: vec![],
            llm_context: None,
        };

        // Create child template
        let child_template = EnhancedConfigTemplate {
            id: "better-auth".to_string(),
            name: "Better Auth Template".to_string(),
            description: "Better Auth specific template".to_string(),
            version: "1.0.0".to_string(),
            author: None,
            provider_id: "better-auth".to_string(),
            provider_name: "Better Auth".to_string(),
            provider_category: "auth".to_string(),
            template_files: vec![
                TemplateFile {
                    id: "better-config".to_string(),
                    name: "Better Auth Config".to_string(),
                    description: "Better Auth configuration".to_string(),
                    file_type: "typescript".to_string(),
                    file_path: "lib/better-auth.ts".to_string(),
                    template_content: "// Better auth config".to_string(),
                    language: "typescript".to_string(),
                    is_required: true,
                    dependencies: vec!["better-auth".to_string()],
                    framework_variants: HashMap::new(),
                    conditions: vec![],
                    category: "config".to_string(),
                    priority: 200,
                }
            ],
            framework_compatibility: vec![],
            required_env_vars: vec!["BETTER_AUTH_SECRET".to_string()],
            optional_env_vars: vec![],
            env_var_descriptions: HashMap::new(),
            dependencies: vec!["better-auth".to_string()],
            dev_dependencies: vec![],
            peer_dependencies: vec![],
            extends: Some("base-auth".to_string()),
            overrides: HashMap::new(),
            supported_features: vec!["advanced-auth".to_string()],
            feature_combinations: HashMap::new(),
            setup_instructions: vec!["Install Better Auth".to_string()],
            usage_examples: vec![],
            next_steps: vec!["Configure Better Auth".to_string()],
            tags: vec!["better-auth".to_string()],
            difficulty_level: "intermediate".to_string(),
            estimated_setup_time: "15 minutes".to_string(),
            documentation_links: vec![],
            validation_rules: vec![],
            llm_context: None,
        };

        // Register base template
        resolver.register_base_template(base_template);

        // Resolve child template
        let resolved = resolver.resolve_template(&child_template, &config).unwrap();

        // Verify inheritance worked
        assert_eq!(resolved.id, "better-auth");
        assert_eq!(resolved.extends, Some("base-auth".to_string()));
        assert_eq!(resolved.template_files.len(), 2); // Should have both files
        assert!(resolved.required_env_vars.contains(&"BASE_SECRET".to_string()));
        assert!(resolved.required_env_vars.contains(&"BETTER_AUTH_SECRET".to_string()));
        assert!(resolved.dependencies.contains(&"base-package".to_string()));
        assert!(resolved.dependencies.contains(&"better-auth".to_string()));
    }
}