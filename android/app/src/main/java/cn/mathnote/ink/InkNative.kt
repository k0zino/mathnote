package cn.mathnote.ink

object InkNative {
    init {
        System.loadLibrary("mathnote_ink")
    }

    @JvmStatic
    external fun nativeRenderStroke(points: FloatArray, brush: Int, size: Float): FloatArray
}
