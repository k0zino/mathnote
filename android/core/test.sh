#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$ROOT/android/core/build"
c++ -std=c++17 -O2 -Wall -Wextra -pedantic \
  -I"$ROOT/android/core" \
  "$ROOT/android/core/ink_core.cpp" \
  "$ROOT/android/core/tests/ink_test.cpp" \
  -o "$ROOT/android/core/build/ink_test"
"$ROOT/android/core/build/ink_test"
node "$ROOT/android/core/tests/cross_platform_test.mjs" "$ROOT/android/core/build/ink_test"
