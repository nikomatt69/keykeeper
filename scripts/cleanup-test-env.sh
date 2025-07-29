#!/bin/bash
echo "🧹 Cleaning up test environment..."
rm -rf "$(dirname "$0")/../test_projects"
echo "✅ Test projects removed!"
