<script setup>
import { ref, onMounted, reactive, computed } from "vue";
import { Howl } from "howler";

// 默认图片（打包时位于 assets）
import defaultPet from "./assets/普通型道理.gif";

// 列出 renderer/src/assets 下的图片资源（Vite 特性）
// 只匹配常见的图片后缀
const modules = import.meta.glob('./assets/*.{png,jpg,jpeg,gif}', { as: 'url' });
const assetEntries = Object.entries(modules);

// 状态
const soundFiles = ref([]);
const showTooltip = ref(false);
const currentTooltip = ref("");
const isLoading = ref(true);
const isPlaying = ref(false);

// 处理宠物素材选择
const assetList = assetEntries.map(([path, resolver]) => ({ path, resolver }));
const assetPreviews = ref([]); // { path, url }
const selectedAsset = ref(null); // 将保存为 URL
const showSettings = ref(false);

const selectedAssetName = computed(() => {
  if (!selectedAsset.value) return null;
  // 从路径中取文件名
  const parts = selectedAsset.value.split('/');
  return parts[parts.length - 1];
});

async function loadSavedSelection() {
  // 优先从主进程读取持久化选择
  if (window.electronAPI && typeof window.electronAPI.getPetSelection === 'function') {
    try {
      const assetPath = await window.electronAPI.getPetSelection();
      if (assetPath) {
        // assetPath 存储为相对于 assets 的文件名，例如 "pet2.gif"
        const match = assetList.find(a => a.path.endsWith('/' + assetPath));
        if (match) {
          selectedAsset.value = await match.resolver();
          return;
        }
      }
    } catch (e) {
      console.error('读取保存的宠物素材失败:', e);
    }
  }
  // fallback: localStorage
  const ls = localStorage.getItem('petAsset');
  if (ls) {
    const match = assetList.find(a => a.path.endsWith('/' + ls));
    if (match) selectedAsset.value = await match.resolver();
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
  await loadSavedSelection();
  // 预解析所有资源的 URL，用于设置面板的缩略图显示
  try {
    const previews = await Promise.all(assetList.map(async (a) => ({ path: a.path, url: await a.resolver() })));
    assetPreviews.value = previews;
  } catch (e) {
    console.error('解析素材预览失败:', e);
  }

  // 监听主进程通过右键菜单发来的选择变更
  if (window.electronAPI && typeof window.electronAPI.onPetSelectionChanged === 'function') {
    window.electronAPI.onPetSelectionChanged(async (fileName) => {
      const match = assetPreviews.value.find(p => p.path.endsWith('/' + fileName));
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
  // entry can be either {path, resolver} or a preview {path, url}
  if (entry.url) {
    selectedAsset.value = entry.url;
    await saveSelection(entry.path);
  } else {
    const url = await entry.resolver();
    selectedAsset.value = url;
    await saveSelection(entry.path);
  }
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