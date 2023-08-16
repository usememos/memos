#!/bin/bash
# This script builds memos for all listed platforms.
# It's only for local builds.

# Before using, setup a proper development environment as described here:
# * https://usememos.com/docs/contribution/development
# * https://github.com/usememos/memos/blob/main/docs/development.md

# Requirements:
# * go
# * node.js
# * npm

# Usage: 
# chmod +x ./scripts/build.sh
# ./scripts/build.sh
#
# Output: ./build/memos-<os>-<arch>[.exe]

goBuilds=(
    # "darwin/amd64"
    # "darwin/arm64"
    "linux/amd64"
    # "linux/arm64"
    # "windows/amd64"
)
ldFlags=(
    "-s" # Omit symbol table and debug information
    "-w" # Omit DWARF symbol table
)

##

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

repo_root=$(find_repo_root)
if [ -z "$repo_root" ]; then
    echo -e "\033[0;31mRepository root not found! Exiting.\033[0m"
    exit 1
else
    echo -e "Repository root: \033[0;34m$repo_root\033[0m"
fi


cd "$repo_root/web"

if ! command -v pnpm &> /dev/null
then
    echo -e "\n\033[35mInstalling pnpm...\033[0m"
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mFailed to install pnpm! Exiting.\033[0m"
        exit 1
    fi
fi

echo -e "\n\033[33mInstalling frontend dependencies...\033[0m"
pnpm i --frozen-lockfile
if [ $? -ne 0 ]; then
    echo -e "\033[0;31mFrontend dependencies failed to install! Exiting.\033[0m"
    exit 1
fi
echo -e "\033[32mFrontend dependencies installed!\033[0m"

echo -e "\n\033[33mBuilding frontend...\033[0m"
pnpm build
if [ $? -ne 0 ]; then
    echo -e "\033[0;31mFrontend build failed! Exiting.\033[0m"
    exit 1
fi
echo -e "\033[32mFrontend built!\033[0m"

cd $repo_root

echo -e "\n\033[35mBacking up frontend placeholder...\033[0m"
mv -f "$repo_root/server/dist" "$repo_root/server/dist.bak"
if [ $? -ne 0 ]; then
    echo -e "\033[0;31mFailed to backup frontend placeholder! Exiting.\033[0m"
    exit 1
fi

echo -e "\033[35mMoving frontend build to ./server/dist...\033[0m"
mv -f "$repo_root/web/dist" "$repo_root/server/"
if [ $? -ne 0 ]; then
    echo -e "\033[0;31mFailed to move frontend build! Exiting.\033[0m"
    exit 1
fi

cd "$repo_root"
echo -e "\n\033[33mBuilding backend...\033[0m"

for build in "${goBuilds[@]}"; do
    os=$(echo $build | cut -d'/' -f1)
    arch=$(echo $build | cut -d'/' -f2)

    output="$repo_root/build/memos-$os-$arch"
    if [ "$os" = "windows" ]; then
        output="$output.exe"
    fi
    
    CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath -ldflags="${ldFlags[*]}" -o "$output" ./main.go

    echo -e "\033[34mBuilding $os/$arch to $output...\033[0m"
    GOOS=$os GOARCH=$arch go build -ldflags="${ldFlags[*]}" -o "./build/memos-$os-$arch" ./main.go
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mgo build failed for $os/$arch($output)! See above.\033[0m"
    fi
done

echo -e "\033[32mBackend built!\033[0m"

echo -e "\n\033[35mRemoving frontend from ./server/dist...\033[0m"
rm -rf $repo_root/server/dist
if [ $? -ne 0 ]
then
    echo -e "\033[93mCould not remove frontend from /server/dist.\033[0m"
    exit 1
fi

echo -e "\033[35mRestoring frontend placeholder...\033[0m"
mv $repo_root/server/dist.bak $repo_root/server/dist
if [ $? -ne 0 ]
then
    echo -e "\033[93mCould not restore frontend placeholder.\033e[0m"
    exit 1
fi

echo -e "\n\033[37mBuilds:\033[0m"
for build in "${goBuilds[@]}"; do
    os=$(echo $build | cut -d'/' -f1)
    arch=$(echo $build | cut -d'/' -f2)
    output="$repo_root/build/memos-$os-$arch"
    if [ "$os" = "windows" ]; then
        output="$output.exe"
    fi
    echo -e "\033[37m$output\033[0m"
done
echo -e "\n\033[32mYou can test the build with \033[37m./build/memos-<os>-<arch>\033[0m\033[90m.exe\033[0m \033[37m--mode demo\033[0m"

cd $repo_root
