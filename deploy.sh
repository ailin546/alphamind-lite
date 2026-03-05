#!/bin/bash
#
# AlphaMind Lite - 一键部署脚本
# One-command deployment for Linux & macOS
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_header() {
    echo -e "${BLUE}"
    echo '╔════════════════════════════════════════════════════════════╗'
    echo '║           🤖 AlphaMind Lite - 一键部署脚本           ║'
    echo '╚════════════════════════════════════════════════════════════╝'
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        OS="unknown"
    fi
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js
check_node() {
    print_info "检查 Node.js 环境..."
    
    if ! command_exists node; then
        print_error "未检测到 Node.js"
        install_node
    else
        NODE_VERSION=$(node --version | sed 's/v//')
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1)
        
        if [ "$MAJOR_VERSION" -ge 20 ]; then
            print_success "Node.js 版本: v$NODE_VERSION (符合要求)"
        else
            print_warning "Node.js 版本: v$NODE_VERSION (需要 20+)"
            install_node
        fi
    fi
}

# 安装 Node.js
install_node() {
    print_info "正在安装 Node.js 20+..."
    
    if [ "$OS" == "macos" ]; then
        if command_exists brew; then
            brew install node@20
            brew link node@20 --force 2>/dev/null || true
        else
            print_error "请先安装 Homebrew: https://brew.sh"
            exit 1
        fi
    elif [ "$OS" == "linux" ]; then
        # 使用 NodeSource 安装
        if command_exists curl; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs 2>/dev/null || \
                yum install -y nodejs 2>/dev/null || \
                { print_error "无法安装 Node.js，请手动安装"; exit 1; }
        else
            print_error "请先安装 curl"
            exit 1
        fi
    else
        print_error "不支持的操作系统"
        exit 1
    fi
    
    print_success "Node.js 安装完成: $(node --version)"
}

# 检查并安装 Git
check_git() {
    if ! command_exists git; then
        print_info "安装 Git..."
        if [ "$OS" == "macos" ]; then
            brew install git
        else
            apt-get update && apt-get install -y git 2>/dev/null || \
                yum install -y git 2>/dev/null || true
        fi
    fi
    
    if command_exists git; then
        print_success "Git: $(git --version | head -n1)"
    fi
}

# 克隆仓库（如需要）
clone_repo() {
    # 如果当前目录已有项目，跳过克隆
    if [ -f "scripts/demo.js" ]; then
        print_info "检测到现有项目，跳过克隆"
        return
    fi
    
    # 如果在项目根目录但不在正确位置
    if [ -d ".git" ]; then
        print_info "检测到 Git 仓库，无需克隆"
        return
    fi
    
    print_info "克隆 AlphaMind Lite 仓库..."
    REPO_URL="https://github.com/ailin546/alphamind-lite.git"
    TARGET_DIR="alphamind-lite"
    
    if git clone "$REPO_URL" "$TARGET_DIR"; then
        cd "$TARGET_DIR"
        print_success "克隆完成"
    else
        print_warning "克隆失败，可能已存在或网络问题"
    fi
}

# 检查依赖
check_dependencies() {
    print_info "检查系统依赖..."
    
    # 检查 curl
    if ! command_exists curl; then
        print_info "安装 curl..."
        if [ "$OS" == "macos" ]; then
            brew install curl
        else
            apt-get update && apt-get install -y curl 2>/dev/null || \
                yum install -y curl 2>/dev/null || true
        fi
    fi
    
    print_success "curl: 已安装"
}

# 验证脚本权限
fix_permissions() {
    print_info "设置脚本执行权限..."
    chmod +x scripts/*.js 2>/dev/null || true
}

# 健康检查
health_check() {
    print_info "进行健康检查..."
    
    # 测试 Binance API
    if curl -s --connect-timeout 5 "https://api.binance.com/api/v3/ping" > /dev/null; then
        print_success "Binance API 连接正常"
    else
        print_warning "Binance API 连接超时（不影响演示）"
    fi
    
    # 测试 Fear & Greed API
    if curl -s --connect-timeout 5 "https://api.alternative.me/fng/" > /dev/null; then
        print_success "Fear & Greed API 连接正常"
    else
        print_warning "Fear & Greed API 连接超时（不影响演示）"
    fi
}

# 运行演示
run_demo() {
    print_header
    print_info "正在启动 AlphaMind Lite 演示..."
    
    # 确定要运行的脚本
    DEMO_SCRIPT="scripts/demo.js"
    
    if [ -f "$DEMO_SCRIPT" ]; then
        print_info "运行演示脚本: $DEMO_SCRIPT"
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # 运行演示
        node "$DEMO_SCRIPT"
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        print_success "演示完成！"
    else
        print_error "未找到演示脚本: $DEMO_SCRIPT"
        exit 1
    fi
}

# 显示使用帮助
show_help() {
    echo -e "${BLUE}"
    echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    echo -e "${NC}"
    echo -e "${GREEN}🚀 AlphaMind Lite 部署成功！${NC}"
    echo ""
    echo "📂 项目目录: $(pwd)"
    echo ""
    echo "📖 常用命令:"
    echo "   node scripts/demo.js              # 标准演示"
    echo "   node scripts/demo-interactive.js  # 交互式菜单"
    echo "   node scripts/fear-greed.js        # 恐慌指数"
    echo "   node scripts/portfolio.js         # 持仓分析"
    echo "   node scripts/market-sentiment.js  # 市场情绪"
    echo ""
    echo "🔧 查看帮助:"
    echo "   cat README.md"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 主函数
main() {
    print_header
    
    # 检测系统
    detect_os
    print_info "检测到操作系统: ${OS}"
    
    # 检查并安装依赖
    check_git
    check_node
    check_dependencies
    
    # 克隆仓库（如果在空目录）
    clone_repo
    
    # 修复权限
    fix_permissions
    
    # 健康检查
    health_check
    
    # 运行演示
    run_demo
    
    # 显示帮助
    show_help
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        echo "AlphaMind Lite - 一键部署脚本"
        echo ""
        echo "用法:"
        echo "  curl -fsSL https://raw.githubusercontent.com/ailin546/alphamind-lite/main/deploy.sh | bash"
        echo "  或"
        echo "  bash deploy.sh"
        echo ""
        echo "选项:"
        echo "  --help, -h     显示帮助"
        echo "  --skip-demo    只安装依赖，不运行演示"
        echo ""
        exit 0
        ;;
    --skip-demo)
        detect_os
        check_git
        check_node
        check_dependencies
        clone_repo
        fix_permissions
        print_success "依赖安装完成！"
        exit 0
        ;;
esac

# 运行主函数
main
