# LLM.rs Integration Plan for KeyKeeper

## Current State Analysis

### Existing Dependencies
- `llm = { version = "1.3.1", features = [] }` already present in Cargo.toml
- `tokenizers = "0.21.4-dev.0"` already present
- Basic LLM wrapper structure exists in `src-tauri/src/llm_wrapper.rs`

### Current ML Engine Structure
- Uses Candle + BERT for embeddings (`ml_engine.rs`)
- HuggingFace Hub integration for model downloads
- Context-aware API key suggestions
- Usage pattern tracking

## Integration Strategy (Minimal Changes)

### Phase 1: Preserve Existing API ✅
Keep all existing ML engine interfaces intact to maintain compatibility with frontend components.

### Phase 2: Add LLM Backend Support
1. **Extend MLEngine struct** to optionally use llm.rs backend
2. **Add configuration option** to choose between Candle and llm.rs
3. **Implement adapter pattern** to provide unified interface

### Phase 3: Model Support
- **Primary**: GGUF models for local inference
- **Fallback**: Keep existing Candle/BERT for embeddings
- **Hybrid approach**: Use llm.rs for text generation, Candle for embeddings

## Implementation Plan

### 1. Update Configuration
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLConfig {
    pub model_cache_path: PathBuf,
    pub embedding_model: String,
    pub max_sequence_length: usize,
    pub batch_size: usize,
    // New fields
    pub use_llm_backend: bool,
    pub llm_model_path: Option<String>,
    pub llm_config: Option<LLMConfig>,
}
```

### 2. Extend MLEngine
```rust
pub struct MLEngine {
    // Existing fields
    config: MLConfig,
    device: Device,
    embedding_model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
    usage_patterns: Arc<RwLock<HashMap<String, Vec<UsagePattern>>>>,
    context_embeddings: Arc<RwLock<HashMap<String, Vec<f32>>>>,
    
    // New field
    llm_engine: Option<crate::llm_wrapper::LLMEngine>,
}
```

### 3. Add LLM-Enhanced Features
- **Documentation generation** using llm.rs text generation
- **API usage examples** generation
- **Context-aware suggestions** with better language understanding
- **Configuration templates** generation

### 4. Preserve Compatibility
- All existing function signatures remain unchanged
- Backend selection happens internally
- Gradual migration path for users

## File Changes Required

### Modified Files
1. **src-tauri/src/ml_engine.rs**
   - Add llm_engine field
   - Add LLM initialization logic
   - Add hybrid inference methods

2. **src-tauri/src/main.rs**
   - Import llm_wrapper module
   - No API changes needed

### New/Enhanced Files
1. **src-tauri/src/llm_wrapper.rs** ✅ (Already exists)
   - Review and enhance existing implementation
   - Add better error handling
   - Add model validation

## Testing Strategy

### Unit Tests
- Test LLM engine initialization
- Test text generation with various prompts
- Test embedding generation compatibility

### Integration Tests
- Test hybrid ML pipeline
- Test fallback mechanisms
- Test configuration switching

### Performance Tests
- Compare inference speeds
- Memory usage comparison
- Model loading times

## Deployment Considerations

### Model Distribution
- Default to lightweight GGUF models
- Provide model download utilities
- Optional GPU acceleration support

### Configuration
- Environment-based model selection
- Runtime configuration switching
- Graceful degradation when models unavailable

## Success Metrics

1. **Compatibility**: All existing ML features work unchanged
2. **Performance**: LLM features add <2s to API key suggestions
3. **Quality**: Generated documentation is contextually relevant
4. **Reliability**: Fallback to existing ML engine when LLM unavailable

## Risk Mitigation

1. **Model Size**: Start with small GGUF models (<1GB)
2. **Memory Usage**: Implement lazy loading and memory management
3. **Compatibility**: Extensive testing on existing functionality
4. **Fallback**: Always maintain Candle backend as fallback