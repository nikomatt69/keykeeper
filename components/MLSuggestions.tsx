"use client";

import React, { useState, useEffect } from 'react';
import { 
    MLService, 
    ContextInfo, 
    MLPrediction, 
    KeySuggestion, 
    RiskLevel,
    KeyFormat 
} from '../lib/services/mlService';
import { TauriAPI, ApiKey } from '../lib/tauri-api';

interface MLSuggestionsProps {
    context?: ContextInfo;
    onKeySelect?: (keyId: string, format: KeyFormat) => void;
    className?: string;
}

const MLSuggestions: React.FC<MLSuggestionsProps> = ({ 
    context, 
    onKeySelect, 
    className = '' 
}) => {
    const [prediction, setPrediction] = useState<MLPrediction | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        initializeML();
    }, []);

    useEffect(() => {
        if (context && isInitialized) {
            loadSuggestions();
        }
    }, [context, isInitialized]);

    const initializeML = async () => {
        try {
            setLoading(true);
            const initialized = await MLService.initialize();
            setIsInitialized(initialized);
            
            if (!initialized) {
                setError('ML Engine initialization failed');
            }
        } catch (err) {
            setError(`ML initialization error: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    const loadSuggestions = async () => {
        if (!context) return;

        try {
            setLoading(true);
            setError(null);

            // Get available API keys
            const keys = await TauriAPI.getApiKeys();
            setApiKeys(keys);

            // Get ML predictions
            const keyIds = keys.map(key => key.id);
            const predictions = await MLService.getSmartSuggestions(context, keyIds);
            setPrediction(predictions);

        } catch (err) {
            setError(`Failed to load suggestions: ${err}`);
        } finally {
            setLoading(false);
        }
    };

    const handleKeySelect = async (suggestion: KeySuggestion) => {
        if (onKeySelect) {
            onKeySelect(suggestion.key_id, suggestion.suggested_format);
        }

        // Record usage for ML learning
        if (context) {
            await MLService.recordUsage(suggestion.key_id, context, true);
        }
    };

    const getKeyName = (keyId: string): string => {
        const key = apiKeys.find(k => k.id === keyId);
        return key ? key.name : keyId;
    };

    const getKeyService = (keyId: string): string => {
        const key = apiKeys.find(k => k.id === keyId);
        return key ? key.service : '';
    };

    const getRiskColor = (riskLevel: RiskLevel): string => {
        switch (riskLevel) {
            case RiskLevel.Low: return 'text-green-600 bg-green-50';
            case RiskLevel.Medium: return 'text-yellow-600 bg-yellow-50';
            case RiskLevel.High: return 'text-orange-600 bg-orange-50';
            case RiskLevel.Critical: return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getFormatIcon = (format: KeyFormat): string => {
        switch (format) {
            case KeyFormat.Plain: return '📝';
            case KeyFormat.EnvironmentVariable: return '🌍';
            case KeyFormat.ProcessEnv: return '⚙️';
            case KeyFormat.ConfigFile: return '📁';
            default: return '📝';
        }
    };

    const getConfidenceColor = (confidence: number): string => {
        if (confidence > 0.8) return 'text-green-600';
        if (confidence > 0.6) return 'text-blue-600';
        if (confidence > 0.4) return 'text-yellow-600';
        return 'text-gray-600';
    };

    if (loading) {
        return (
            <div className={`p-4 ${className}`}>
                <div className="animate-pulse">
                    <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                        <div className="h-4 bg-gray-300 rounded w-24"></div>
                    </div>
                    <div className="mt-3 space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 bg-red-50 border border-red-200 rounded-md ${className}`}>
                <div className="flex items-center">
                    <span className="text-red-500">⚠️</span>
                    <span className="ml-2 text-red-700 text-sm">{error}</span>
                </div>
                <button 
                    onClick={initializeML}
                    className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                    Retry initialization
                </button>
            </div>
        );
    }

    if (!prediction) {
        return null;
    }

    return (
        <div className={`p-4 bg-white rounded-lg border ${className}`}>
            {/* Header with context confidence */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    🤖 Smart Suggestions
                </h3>
                <div className="text-sm text-gray-500">
                    Confidence: {Math.round(prediction.context_confidence * 100)}%
                </div>
            </div>

            {/* Security Score Alert */}
            {prediction.security_score.risk_level !== RiskLevel.Low && (
                <div className={`mb-4 p-3 rounded-md ${getRiskColor(prediction.security_score.risk_level)}`}>
                    <div className="flex items-center">
                        <span className="font-medium">
                            🔒 Security Alert: {prediction.security_score.risk_level} Risk
                        </span>
                    </div>
                    {prediction.security_score.reasons.length > 0 && (
                        <ul className="mt-2 text-sm list-disc list-inside">
                            {prediction.security_score.reasons.map((reason, index) => (
                                <li key={index}>{reason}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Key Suggestions */}
            <div className="space-y-2">
                {prediction.api_key_suggestions.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">
                        No relevant keys found for this context
                    </div>
                ) : (
                    prediction.api_key_suggestions.map((suggestion, index) => (
                        <div 
                            key={suggestion.key_id}
                            className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleKeySelect(suggestion)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-medium text-gray-800">
                                            {getKeyName(suggestion.key_id)}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            ({getKeyService(suggestion.key_id)})
                                        </span>
                                        <span className="text-sm">
                                            {getFormatIcon(suggestion.suggested_format)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {suggestion.reason}
                                    </div>
                                </div>
                                <div className={`text-sm font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                                    {Math.round(suggestion.confidence * 100)}%
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Usage Prediction */}
            {prediction.usage_prediction.predicted_next_usage && (
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <div className="text-sm text-blue-700">
                        📊 Predicted next usage: {new Date(prediction.usage_prediction.predicted_next_usage).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                        Based on frequency ({Math.round(prediction.usage_prediction.frequency_score * 100)}%) 
                        and recency ({Math.round(prediction.usage_prediction.recency_score * 100)}%) patterns
                    </div>
                </div>
            )}

            {/* Context Info */}
            {context && (
                <details className="mt-4">
                    <summary className="text-sm text-gray-500 cursor-pointer">
                        Context Details
                    </summary>
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <div>App: {context.active_app || 'Unknown'}</div>
                        {context.file_extension && <div>File Type: .{context.file_extension}</div>}
                        {context.project_type && <div>Project: {context.project_type}</div>}
                        {context.language && <div>Language: {context.language}</div>}
                    </div>
                </details>
            )}
        </div>
    );
};

export default MLSuggestions;