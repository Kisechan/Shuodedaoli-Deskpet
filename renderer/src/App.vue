<script setup>
import { ref, onMounted, reactive } from "vue";
import petGif from "./assets/pet.gif";
import { Howl } from "howler";

// 状态管理
const soundFiles = ref([]);   // 存储从主进程获取的声音文件名列表
const showTooltip = ref(false);
const currentTooltip = ref("");
const isLoading = ref(true);  // 跟踪文件列表是否已加载
const isPlaying = ref(false); // 是否正在播放音效，用作锁

// 在组件挂载后，从主进程获取声音文件列表
onMounted(async () => {
  if (window.electronAPI && typeof window.electronAPI.getSoundFiles === 'function') {
    try {
      soundFiles.value = await window.electronAPI.getSoundFiles();
    } catch (error) {
      console.error("获取声音文件列表失败:", error);
    } finally {
      isLoading.value = false;
    }
  }
});

const playRandomSound = async () => {
  if (isPlaying.value) return;
  if (isLoading.value || soundFiles.value.length === 0) return;
  const randomSoundFile = soundFiles.value[Math.floor(Math.random() * soundFiles.value.length)];
  isPlaying.value = true; // 加锁
  try {
    const audioUrl = await window.electronAPI.getSoundPath(randomSoundFile);
    if (audioUrl) {
      new Howl({
        src: [audioUrl],
        format: ["mp3"],
        // 当音频播放结束时
        onend: function() {
          // 隐藏提示框
          showTooltip.value = false;
          // 解锁，允许下一次点击
          isPlaying.value = false;
        }
      }).play();
    } else {
        // 如果音频路径获取失败，也要解锁
        isPlaying.value = false;
    }
  } catch (err) {
    // 如果播放过程出错，也要解锁
    isPlaying.value = false;
    console.error("播放失败:", err);
  }
  if (randomSoundFile === "哇袄.mp3") {
    currentTooltip.value = "哇袄！！！";
  } else {
    currentTooltip.value = randomSoundFile.replace(/\.mp3$/, '');
  }
  showTooltip.value = true;
};

const dragState = reactive({
  isDragging: false,
  hasMoved: false,
  // 分别记录鼠标和窗口的起始位置
  mouseStartX: 0,
  mouseStartY: 0,
  windowStartX: 0,
  windowStartY: 0,
});

// 鼠标按下事件 (改为异步函数)
async function handleMouseDown(event) {
  // 如果按下的不是鼠标左键，则不执行任何操作
  if (event.button !== 0) {
    return;
  }
  // 在拖动开始时，先获取窗口的当前位置
  const { x, y } = await window.electronAPI.getWindowPosition();
  dragState.windowStartX = x;
  dragState.windowStartY = y;

  // 记录鼠标的初始位置
  dragState.mouseStartX = event.screenX;
  dragState.mouseStartY = event.screenY;
  
  dragState.isDragging = true;
  dragState.hasMoved = false;
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

// 鼠标移动事件
function handleMouseMove(event) {
  if (!dragState.isDragging) return;

  // 计算鼠标从起点移动的距离（偏移量）
  const deltaX = event.screenX - dragState.mouseStartX;
  const deltaY = event.screenY - dragState.mouseStartY;

  if (!dragState.hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
    dragState.hasMoved = true;
  }
  
  // 计算窗口的新位置 = 窗口初始位置 + 鼠标偏移量
  const newWindowX = dragState.windowStartX + deltaX;
  const newWindowY = dragState.windowStartY + deltaY;

  // 将计算出的正确位置发送给主进程
  window.electronAPI.moveWindow({ x: newWindowX, y: newWindowY });
}

// 鼠标抬起事件
function handleMouseUp() {
  // 如果鼠标按下后没有真正移动过，就认为这是一次点击
  if (dragState.isDragging && !dragState.hasMoved) {
    playRandomSound();
  }

  // 状态重置
  dragState.isDragging = false;
  
  // 移除全局监听器(非常重要)
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

function handleRightClick() {
  window.electronAPI.showContextMenu();
}
</script>

<template>
  <div 
    class="pet-container" 
    @mousedown="handleMouseDown"
    @contextmenu.prevent="handleRightClick"
  >
    <transition name="fade">
      <div v-if="showTooltip" class="tooltip">
        {{ currentTooltip }}
      </div>
    </transition>
    <img :src="petGif" class="pet-gif" />
  </div>
</template>

<style>
/* 全局样式保持不变 */
html, body, #app {
  background-color: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>

<style scoped>
/* 样式大大简化 */
.pet-container {
  width: 200px;
  height: 200px;
  position: relative;
  cursor: pointer;
  user-select: none; /* 防止拖动时选中文本 */
}

.pet-gif {
  width: 100%;
  height: 100%;
  display: block;
  /* 图片现在不接收任何鼠标事件，所有事件都由父容器处理 */
  pointer-events: none; 
}

.tooltip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none; /* 提示框也不响应鼠标 */
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>