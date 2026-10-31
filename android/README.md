# MathNote Android

独立的原生 Android 客户端，使用 Kotlin、Jetpack Compose Material 3 和 C++ 笔迹内核。

## 已实现

- Material 3 明暗主题；Android 12 及以上支持系统动态配色
- 820 × 1160 文档坐标系，显示缩放不改变笔迹几何
- 压感笔、圆珠笔、钢笔、平口矩形荧光笔
- 手写笔压感；手指和鼠标使用固定 0.5 压力
- 消费 `MotionEvent` 历史采样点，单活动指针书写
- 颜色、粗细和当前页清空
- 每个笔记本独立保存最多 50 步撤销/重做历史，覆盖笔划、页面和清空操作
- 新建、删除和前后切换页面，始终为笔记本保留至少一页
- “我的笔记”选择界面，可新建和切换笔记本
- 使用应用私有目录中的 `notebooks.json` 自动保存笔记本、页面和完整笔迹，重启后恢复
- C++ 几何结果与桌面 TypeScript 渲染逐命令数值对照

当前版本专注手写与本地笔记，尚未接入 PDF、AI 和云同步。撤销/重做历史仅保留在本次进程内。

## 结构

```text
app/                    Android 应用与 Material 3 UI
  src/main/cpp/         CMake 与 JNI 桥接
  src/main/java/        Compose UI、笔记控制器、JSON 存储与原生 MotionEvent 输入
core/                   可移植 C++17 笔迹内核
  tests/                C++ 单元测试和 TypeScript 对照测试
```

笔刷参数、压力曲线、Catmull–Rom 重采样、轮廓、圆头和平头端点全部位于 `core/ink_core.cpp`。Android 只负责把内核输出的命令绘制到 `android.graphics.Canvas`，避免各平台分别调整算法导致笔迹不一致。

## 构建

需要 JDK 17、Android SDK 35、Android NDK 和 CMake 3.22.1。可以直接用 Android Studio 打开本目录，或执行：

```bash
./gradlew assembleDebug
```

APK 输出到 `app/build/outputs/apk/debug/app-debug.apk`。

## 验证笔迹一致性

在 MathNote 项目根目录执行：

```bash
bash android/core/test.sh
# 或
npm run test:android-core
```

测试先编译并运行 C++ 单元测试，再让 C++ 与桌面 TypeScript 对同一组输入生成几何命令，逐项比较命令类型和坐标数值。后续 iOS、HarmonyOS 应复用同一个 `core/`，不要复制后再分别修改。
