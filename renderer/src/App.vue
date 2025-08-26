<script setup>
import { ref, onMounted, reactive } from "vue";
import petGif from "./assets/pet.gif";
import { Howl } from "howler";

// 状态管理
const soundFiles = ref([]);   // 存储从主进程获取的声音文件名列表
const showTooltip = ref(false);
const currentTooltip = ref("");
const isLoading = ref(true);  // 跟踪文件列表是否已加载

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
  if (isLoading.value || soundFiles.value.length === 0) return;
  const randomSoundFile = soundFiles.value[Math.floor(Math.random() * soundFiles.value.length)];
  try {
    const audioUrl = await window.electronAPI.getSoundPath(randomSoundFile);
    if (audioUrl) new Howl({ src: [audioUrl], format: ["mp3"] }).play();
  } catch (err) {
    console.error("播放失败:", err);
  }
  currentTooltip.value = randomSoundFile.replace(/\.mp3$/, '');
  showTooltip.value = true;
  setTimeout(() => (showTooltip.value = false), 2000);
};

// 新的拖拽与点击处理逻辑
const dragState = reactive({
  isDragging: false,    // 是否正在拖动
  hasMoved: false,      // 本次拖动是否真的移动了
  startX: 0,            // 鼠标按下的起始 X 坐标
  startY: 0,            // 鼠标按下的起始 Y 坐标
});

// 鼠标按下事件
function handleMouseDown(event) {
  dragState.isDragging = true;
  dragState.hasMoved = false; // 重置移动状态
  dragState.startX = event.screenX;
  dragState.startY = event.screenY;
  
  // 添加全局监听器
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

// 鼠标移动事件
function handleMouseMove(event) {
  if (!dragState.isDragging) return;

  const deltaX = event.screenX - dragState.startX;
  const deltaY = event.screenY - dragState.startY;

  // 如果移动超过一个小阈值（例如5像素），我们才认为这是一次“拖动”
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    dragState.hasMoved = true;
  }
  
  // 实时通知主进程移动窗口
  window.electronAPI.moveWindow({ x: event.screenX, y: event.screenY });
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
</script>

<template>
  <div class="pet-container" @mousedown="handleMouseDown">
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