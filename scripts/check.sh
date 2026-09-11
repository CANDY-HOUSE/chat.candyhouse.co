#!/usr/bin/env bash
# 本地机械检查入口。由 `npm run check` 调用。
# 与 CI（.github/workflows/main.yml 的 "Run checks" 步骤）跑的是同一入口。
#
# 用法：
#   npm run check                      全量（CI / Feature 收尾用）
#   npm run check -- <范围> [<范围>…]   Jest 只跑匹配范围（push 到远程前用）
#
# 范围参数是 Jest 内置的 testPathPattern（本脚本只做透传），多个之间是 OR 关系：
#   npm run check -- src/features/dialog
#   npm run check -- conversationConfig useMessage
#
# 匹配规则（实测）：正则而非 glob；匹配对象是绝对路径；忽略大小写。
#   ⚠ 别用 ^ 锚定 src —— 实际匹配 /Users/…/candyhouseAI/src/…，^src/utils 会 0 匹配
#   ⚠ 别写 glob（src/**/*.test.ts）—— Jest 判定无效后会降级跑全量并返回 0
#   ✓ 范围拼错会 0 matches 并以退出码 1 硬失败，不会静默跳过
#   ❗ 不要加 --passWithNoTests，那会把上面这层保护变成静默通过
#
# 范围只作用于 Jest。ESLint 与 tsc 恒为全量——类型检查是项目级的，
# 收窄范围会漏掉跨文件影响。不带参数即全量，所以 CI 无需特殊配置。
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

run() {
  local name=$1
  shift
  printf '\n\033[1m▶ %s\033[0m\n' "$name"
  if "$@"; then
    printf '\033[32m✔ %s 通过\033[0m\n' "$name"
  else
    printf '\033[31m✘ %s 失败\033[0m\n' "$name"
    fail=1
  fi
}

run 'ESLint'     npx --no-install eslint src
run 'TypeScript' npx --no-install tsc --noEmit
# "$@" 在 set -u 下为空时可安全展开（数组不行——macOS 自带 bash 3.2）。
run 'Jest'       npx --no-install react-scripts test --watchAll=false "$@"

# 注意：测试文件（*.test.ts / *.spec.ts）被 tsconfig.json 的 exclude 排除，
# 因此不受上面 TypeScript 一步的类型检查覆盖 —— 仓库未安装 @types/jest。

printf '\n'
if [ "$fail" -eq 0 ]; then
  printf '\033[32m全部检查通过\033[0m\n'
else
  printf '\033[31m存在失败项，见上方输出\033[0m\n'
fi
exit "$fail"
