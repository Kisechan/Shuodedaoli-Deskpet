<script setup>
import { ref, onMounted, reactive, computed } from "vue";
import { Howl } from "howler";

import defaultPet from "/public/pets/说的道理.gif";

// 状态
const soundFiles = ref([]);
const showTooltip = ref(false);
const currentTooltip = ref("");
const isLoading = ref(true);
const isPlaying = ref(false);

// 处理宠物素材选择
const assetPreviews = ref([]); // { name, fileName, url }
const selectedAsset = ref(null); // 将保存为 URL
const showSettings = ref(false);

const selectedAssetName = computed(() => {
  if (!selectedAsset.value) return null;
  const match = assetPreviews.value.find(p => p.url === selectedAsset.value);
  if (match) return match.name;
  // fallback: 从 URL 中取最后一段
  const parts = selectedAsset.value.split('/');
  return parts[parts.length - 1];
});

async function loadSavedSelection() {
  // 优先从主进程读取持久化选择（返回 fileName）
  try {
    if (window.electronAPI && typeof window.electronAPI.getPetSelection === 'function') {
      const fileName = await window.electronAPI.getPetSelection();
      if (fileName) {
        const match = assetPreviews.value.find(p => p.fileName === fileName);
        if (match) {
          selectedAsset.value = match.url;
          return;
        }
        // 如果 assetPreviews 中没有，但文件名存在，尝试直接请求 URL
        if (window.electronAPI && typeof window.electronAPI.getPetUrl === 'function') {
          const url = await window.electronAPI.getPetUrl(fileName);
          if (url) { selectedAsset.value = url; return; }
        }
      }
    }
  } catch (e) {
    console.error('读取保存的宠物素材失败:', e);
  }
  // fallback: localStorage
  try {
    const ls = localStorage.getItem('petAsset');
    if (ls) {
      const match = assetPreviews.value.find(p => p.fileName === ls);
      if (match) { selectedAsset.value = match.url; return; }
      if (window.electronAPI && typeof window.electronAPI.getPetUrl === 'function') {
        const url = await window.electronAPI.getPetUrl(ls);
        if (url) selectedAsset.value = url;
      }
    }
  } catch (e) {
    // ignore
  }
}

async function saveSelection(assetPath) {
  const fileName = assetPath.replace(/^.*\//, '');
  // 保存到主进程
  if (window.electronAPI && typeof window.electronAPI.setPetSelection === 'function') {
    try {
      await window.electronAPI.setPetSelection(fileName);
    } catch (e) {
      console.error('保存宠物素材失败:', e);
    }
  }
  // fallback: localStorage
  try { localStorage.setItem('petAsset', fileName); } catch (_) {}
}

// 初始化
onMounted(async () => {
  // 加载声音文件列表
  if (window.electronAPI && typeof window.electronAPI.getSoundFiles === 'function') {
    try {
      soundFiles.value = await window.electronAPI.getSoundFiles();
    } catch (err) {
      console.error("获取声音文件列表失败:", err);
    } finally {
      isLoading.value = false;
    }
  }
  // 从主进程读取 public/pets 下的素材文件名，然后为每个文件请求可用 URL
  try {
    if (window.electronAPI && typeof window.electronAPI.getPetFiles === 'function') {
      const files = await window.electronAPI.getPetFiles();
      const previews = await Promise.all(files.map(async (file) => {
        const url = await window.electronAPI.getPetUrl(file);
        const name = file.replace(/\.[^.]+$/, '');
        const displayName = name + (/\.gif$/i.test(file) ? '（可动）' : '');
        return { fileName: file, url, name: displayName };
      }));
      assetPreviews.value = previews;
    }
  } catch (e) {
    console.error('获取 pets 列表失败:', e);
  }

  // 加载并应用保存的选择（依赖于 assetPreviews 已构建）
  await loadSavedSelection();

  // 监听主进程通过右键菜单发来的选择变更
  if (window.electronAPI && typeof window.electronAPI.onPetSelectionChanged === 'function') {
    window.electronAPI.onPetSelectionChanged(async (fileName) => {
      const match = assetPreviews.value.find(p => p.fileName === fileName);
      if (match) selectedAsset.value = match.url;
    });
  }
});

const petGifUrl = computed(() => selectedAsset.value || defaultPet);

const playRandomSound = async () => {
  if (isPlaying.value) return;
  if (isLoading.value || soundFiles.value.length === 0) return;
  const randomSoundFile = soundFiles.value[Math.floor(Math.random() * soundFiles.value.length)];
  isPlaying.value = true;
  try {
    const audioUrl = await window.electronAPI.getSoundPath(randomSoundFile);
    if (audioUrl) {
      new Howl({
        src: [audioUrl],
        format: ["mp3"],
        onend: function() {
          showTooltip.value = false;
          isPlaying.value = false;
        }
      }).play();
    } else {
      isPlaying.value = false;
    }
  } catch (err) {
    isPlaying.value = false;
    console.error("播放失败:", err);
  }
  currentTooltip.value = randomSoundFile.replace(/\.mp3$/, '');
  showTooltip.value = true;
};

const dragState = reactive({
  isDragging: false,
  hasMoved: false,
  mouseStartX: 0,
  mouseStartY: 0,
  windowStartX: 0,
  windowStartY: 0,
});

async function handleMouseDown(event) {
  if (event.button !== 0) return;
  const { x, y } = await window.electronAPI.getWindowPosition();
  dragState.windowStartX = x;
  dragState.windowStartY = y;
  dragState.mouseStartX = event.screenX;
  dragState.mouseStartY = event.screenY;
  dragState.isDragging = true;
  dragState.hasMoved = false;
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event) {
  if (!dragState.isDragging) return;
  const deltaX = event.screenX - dragState.mouseStartX;
  const deltaY = event.screenY - dragState.mouseStartY;
  if (!dragState.hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) dragState.hasMoved = true;
  const newWindowX = dragState.windowStartX + deltaX;
  const newWindowY = dragState.windowStartY + deltaY;
  window.electronAPI.moveWindow({ x: newWindowX, y: newWindowY });
}

function handleMouseUp() {
  if (dragState.isDragging && !dragState.hasMoved) playRandomSound();
  dragState.isDragging = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

function handleRightClick() { window.electronAPI.showContextMenu(); }

async function chooseAsset(entry) {
  // entry is { fileName, url, name }
  selectedAsset.value = entry.url;
  await saveSelection(entry.fileName);
  showSettings.value = false;
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
    <img :src="petGifUrl" class="pet-gif" />
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