#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
# Setup script for Superset Codespaces development environment

echo "🔧 Setting up Superset development environment..."

# The universal image has most tools, just need Superset-specific libs
echo "📦 Installing Superset-specific dependencies..."
sudo apt-get update
sudo apt-get install -y \
    libsasl2-dev \
    libldap2-dev \
    libpq-dev \
    tmux \
    gh

# Install uv for fast Python package management
echo "📦 Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add cargo/bin to PATH for uv
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc

# Install Claude Code CLI via npm
echo "🤖 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

# Make the start script executable
chmod +x .devcontainer/start-superset.sh

echo "✅ Development environment setup complete!"
echo "🚀 Run '.devcontainer/start-superset.sh' to start Superset"
