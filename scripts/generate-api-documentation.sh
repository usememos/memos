#!/bin/bash

# This script generates API documentation using swaggo/swag

# For more details, check the docs:
# * https://usememos.com/docs/contribution/development
# * https://github.com/usememos/memos/blob/main/docs/api/documentation.md

# Requirements:
# * go

# swag is configured via generate-api-documentation.cfg file.

# Usage:
# chmod +x ./scripts/generate-api-documentation.sh
# ./scripts/generate-api-documentation.sh

find_repo_root() {
    # Usage: find_repo_root <file_at_root> <dir1> <dir2> ...
    local looking_for="${1:-".gitignore"}"
    shift
    local default_dirs=("." "../")
    local dirs=("${@:-${default_dirs[@]}}")
    for dir in "${dirs[@]}"; do
        if [ -f "$dir/$looking_for" ]; then
            echo $(realpath "$dir")
            return
        fi
    done
}

find_binary() {
    # Usage: find_binary <binary> <dir1> <dir2> ...
    local looking_for="$1"
    shift
    local default_dirs=(".")

    local binary=$(command -v $looking_for)
    if [ ! -z "$binary" ]; then
        echo "$binary"
        return
    fi

    local dirs=("${@:-${default_dirs[@]}}")
    for dir in "${dirs[@]}"; do
        if [ -f "$dir/$looking_for" ]; then
            echo $(realpath "$dir")/$looking_for
            return
        fi
    done
}

repo_root=$(find_repo_root)
if [ -z "$repo_root" ]; then
    echo -e "\033[0;31mRepository root not found! Exiting.\033[0m"
    exit 1
else
    echo -e "Repository root: \033[0;34m$repo_root\033[0m"
fi
cd $repo_root

echo "Parsing generate-api-documentation.cfg..."
source "$repo_root/scripts/generate-api-documentation.cfg"

echo -e "API directories: \033[0;34m$SWAG_API_DIRS\033[0m"
echo -e "Output directory: \033[0;34m$SWAG_OUTPUT\033[0m"
echo -e "General info: \033[0;34m$SWAG_GENERAL_INFO\033[0m"

if [ -z "$SWAG_API_DIRS" ]; then
    echo -e "\033[0;31mAPI directories not set! Exiting.\033[0m"
    exit 1
fi

swag=$(find_binary swag "$HOME/go/bin" "$GOPATH/bin")
if [ -z "$swag" ]; then
    echo "Swag is not installed. Installing..."
    go install github.com/swaggo/swag/cmd/swag@latest
    swag=$(find_binary swag "$HOME/go/bin" "$GOPATH/bin")
fi

if [ -z "$swag" ]; then
    echo -e "\033[0;31mSwag binary not found! Exiting.\033[0m"
    exit 1
fi
echo -e "Swag binary: \033[0;34m$swag\033[0m"

general_info_path=$(dirname "$SWAG_GENERAL_INFO")
if [ ! -d "$general_info_path" ]; then
    echo -e "\033[0;31mGeneral info directory does not exist!\033[0m"
    exit 1
fi

echo -e "\e[35mFormatting comments via \`swag fmt --dir "$general_info_path,$SWAG_API_DIRS"\`...\e[0m"
$swag fmt --dir "$general_info_path,$SWAG_API_DIRS"

# This is just in case "swag fmt" do something non-conforming to "go fmt"
go_fmt_dirs=$(echo $general_info_path $SWAG_API_DIRS | tr "," " ")
echo -e "\e[35mFormatting code via \`go fmt $go_fmt_dirs\`...\e[0m"
go fmt $go_fmt_dirs

echo -e "\e[35mGenerating Swagger API documentation...\e[0m"
$swag init --output "$SWAG_OUTPUT" --outputTypes "$SWAG_OUTPUT_TYPES" --generalInfo "$SWAG_GENERAL_INFO" --dir "./,$SWAG_API_DIRS"

if [ $? -ne 0 ]; then
    echo -e "\033[0;31mFailed to generate Swagger API documentation!\033[0m"
    exit 1
fi
echo -e "\033[0;32mSwagger API documentation updated!\033[0m"
