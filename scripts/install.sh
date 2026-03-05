#!/bin/bash
#
# AlphaMind Lite - 跨平台安装脚本
# Cross-platform installation script for Linux & macOS & Windows (WSL)
#

# ============================================
# 错误处理配置
# ============================================
set -euo pipefail  # 严格模式

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================
# 颜色定义
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================
# 日志函数
# ============================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1" >&2
}

log_step() {
    echo -e "${CYAN}[→]${NC} $1"
}

# ============================================
# 错误处理函数
# ============================================
error_handler() {
    local line_no=$1
    local error_code=$2
    log_error "安装失败，位于第 $line_no 行，错误码: $error_code"
    log_error "请查看上方错误信息，或运行: bash $0 --debug"
    exit "$error_code"
}

trap 'error_handler ${LINENO} $?' ERR

# ============================================
# 检测操作系统
# ============================================
detect_os() {
    local os_name=""
    local os_version=""
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        os_name="linux"
        # 检测具体发行版
        if [[ -f /etc/os-release ]]; then
            os_version="$(. /etc/os-release && echo "$ID")"
        elif [[ -f /etc/lsb-release ]]; then
            os_version="$(. /etc/lsb-release && echo "$DISTRIB_ID")"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        os_name="macos"
        os_version="$(sw_vers -productVersion)"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        os_name="windows"
    else
        os_name="unknown"
    fi
    
    echo "$os_name:$os_version"
}

# ============================================
# 检查命令是否存在
# ============================================
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================
# 检查 Node.js
# ============================================
check_node() {
    log_step "检查 Node.js 环境..."
    
    if ! command_exists node; then
        log_warning "未检测到 Node.js，开始安装..."
        install_node
    else
        local node_version
        node_version=$(node --version | sed 's/v//')
        local major_version
        major_version=$(echo "$node_version" | cut -d. -f1)
        
        if [[ "$major_version" -ge 20 ]]; then
            log_success "Node.js v$node_version (符合要求)"
        else
            log_warning "Node.js v$node_version (需要 20+)，开始升级..."
            install_node
        fi
    fi
}

# ============================================
# 安装 Node.js
# ============================================
install_node() {
    local os_info
    os_info=$(detect_os)
    local os_name
    os_name=$(echo "$os_info" | cut -d: -f1)
    
    log_info "正在安装 Node.js 20 LTS..."
    
    case "$os_name" in
        macos)
            install_node_macos
            ;;
        linux)
            install_node_linux
            ;;
        windows)
            install_node_windows
            ;;
        *)
            log_error "不支持的操作系统: $os_name"
            log_info "请手动安装 Node.js 20+: https://nodejs.org"
            exit 1
            ;;
    esac
    
    log_success "Node.js 安装完成: $(node --version)"
}

install_node_macos() {
    if command_exists brew; then
        log_info "使用 Homebrew 安装..."
        brew install node@20
        brew link node@20 --force 2>/dev/null || true
    elif command_exists curl; then
        log_info "下载 Node.js 安装包..."
        curl -fsSL "https://nodejs.org/dist/v20.11.0/node-v20.11.0.pkg" -o /tmp/node.pkg
        sudo installer -pkg /tmp/node.pkg -target /
        rm -f /tmp/node.pkg
    else
        log_error "请先安装 Homebrew (https://brew.sh) 或 curl"
        exit 1
    fi
}

install_node_linux() {
    local os_info
    os_info=$(detect_os)
    local os_version
    os_version=$(echo "$os_info" | cut -d: -f2)
    
    if command_exists curl; then
        log_info "使用 NodeSource 安装..."
        # 检测是否有 sudo
        local npm_cmd="apt-get"
        if ! command_exists sudo; then
            npm_cmd="apt-get"
        else
            npm_cmd="sudo apt-get"
        fi
        
        # 检查是否为 Debian/Ubuntu
        if [[ "$os_version" == "debian" ]] || [[ "$os_version" == "ubuntu" ]] || [[ "$os_version" == "linuxmint" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null || {
                $npm_cmd install -y nodejs 2>/dev/null || true
            }
        elif [[ "$os_version" == "centos" ]] || [[ "$os_version" == "rhel" ]] || [[ "$os_version" == "fedora" ]]; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || {
                yum install -y nodejs 2>/dev/null || true
            }
        else
            # 通用安装
            $npm_cmd update && $npm_cmd install -y curl
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            $npm_cmd install -y nodejs
        fi
    else
        log_error "请先安装 curl"
        exit 1
    fi
}

install_node_windows() {
    log_error "Windows 原生不支持，请使用 WSL 或手动安装"
    log_info "下载 Node.js: https://nodejs.org"
    exit 1
}

# ============================================
# 检查并安装依赖
# ============================================
check_dependencies() {
    log_step "检查系统依赖..."
    
    local missing_deps=()
    
    # 检查 curl
    if ! command_exists curl; then
        missing_deps+=("curl")
    fi
    
    # 检查 git
    if ! command_exists git; then
        missing_deps+=("git")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_info "安装缺失依赖: ${missing_deps[*]}"
        install_dependencies "${missing_deps[@]}"
    fi
    
    log_success "所有依赖已安装"
}

install_dependencies() {
    local os_info
    os_info=$(detect_os)
    local os_name
    os_name=$(echo "$os_info" | cut -d: -f1)
    
    case "$os_name" in
        macos)
            if command_exists brew; then
                brew install "$@"
            fi
            ;;
        linux)
            local cmd="sudo apt-get install -y"
            if ! command_exists sudo; then
                cmd="apt-get install -y"
            fi
            $cmd "$@" 2>/dev/null || true
            ;;
    esac
}

# ============================================
# 设置脚本权限
# ============================================
fix_permissions() {
    log_step "设置脚本执行权限..."
    
    cd "$PROJECT_ROOT" || exit 1
    
    if [[ -d "scripts" ]]; then
        find scripts -name "*.js" -type f -exec chmod +x {} \; 2>/dev/null || true
        find scripts -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    fi
    
    log_success "权限设置完成"
}

# ============================================
# 验证安装
# ============================================
verify_installation() {
    log_step "验证安装..."
    
    cd "$PROJECT_ROOT" || exit 1
    
    # 检查 Node.js
    if ! command_exists node; then
        log_error "Node.js 未正确安装"
        return 1
    fi
    
    local node_version
    node_version=$(node --version)
    log_success "Node.js: $node_version"
    
    # 检查 npm
    if command_exists npm; then
        local npm_version
        npm_version=$(npm --version)
        log_success "npm: $npm_version"
    fi
    
    log_success "安装验证通过"
}

# ============================================
# 显示帮助
# ============================================
show_help() {
    echo -e "${BOLD}AlphaMind Lite - 跨平台安装脚本${NC}"
    echo ""
    echo "用法:"
    echo "  bash scripts/install.sh           # 安装并验证"
    echo "  bash scripts/install.sh --check   # 仅检查环境"
    echo "  bash scripts/install.sh --force   # 强制重新安装 Node.js"
    echo "  bash scripts/install.sh --help    # 显示帮助"
    echo ""
    echo "支持的系统:"
    echo "  - Linux (Debian, Ubuntu, CentOS, Fedora)"
    echo "  - macOS"
    echo "  - Windows (WSL)"
}

# ============================================
# 主函数
# ============================================
main() {
    local check_only=false
    local force_install=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --check|-c)
                check_only=true
                shift
                ;;
            --force|-f)
                force_install=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            --debug)
                set -x
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo -e "${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║     🤖 AlphaMind Lite 安装向导                      ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # 检测系统
    local os_info
    os_info=$(detect_os)
    local os_name
    os_name=$(echo "$os_info" | cut -d: -f1)
    log_info "检测到操作系统: $os_name"
    
    if [[ "$check_only" == true ]]; then
        check_node
        check_dependencies
        verify_installation
        exit 0
    fi
    
    # 安装步骤
    check_dependencies
    check_node
    fix_permissions
    verify_installation
    
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ 安装完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "下一步运行:"
    echo "  ${CYAN}node scripts/demo.js${NC}"
    echo ""
}

# 运行主函数
main "$@"
