<script setup>
import { ref, onMounted } from "vue";
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
      const files = await window.electronAPI.getSoundFiles();
      soundFiles.value = files;
      console.log("成功加载声音文件:", files);
    } catch (error) {
      console.error("获取声音文件列表失败:", error);
    } finally {
      isLoading.value = false;
    }
  } else {
    console.error("electronAPI.getSoundFiles 函数不存在。");
    isLoading.value = false;
  }
});


// 点击事件处理
const handleClick = async () => {
  // 如果正在加载或没有声音文件，则不执行任何操作
  if (isLoading.value || soundFiles.value.length === 0) {
    console.warn("声音文件尚未加载或列表为空。");
    return;
  }

  // 从文件列表中随机选择一个文件
  const randomSoundFile =
    soundFiles.value[Math.floor(Math.random() * soundFiles.value.length)];
  console.log("请求播放:", randomSoundFile);

  try {
    const audioUrl = await window.electronAPI?.getSoundPath(randomSoundFile);

    if (audioUrl) {
      const sound = new Howl({
        src: [audioUrl],
        format: ["mp3"],
      });
      sound.play();
    } else {
      console.error("无法获取音频路径:", randomSoundFile);
    }
  } catch (err) {
    console.error("播放失败:", err);
  }

  // 将提示文案设置为文件名
  currentTooltip.value = randomSoundFile.replace(/\.mp3$/, '');
  showTooltip.value = true;
  setTimeout(() => (showTooltip.value = false), 2000);
};
</script>

<template>
  <div class="pet-container">
    <transition name="fade">
      <div v-if="showTooltip" class="tooltip">
        {{ currentTooltip }}
      </div>
    </transition>
    <img :src="petGif" class="pet-gif" @click="handleClick" />
  </div>
</template>

<style>
html, body, #app {
  background-color: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden; /* 隐藏滚动条 */
}
</style>

<style scoped>
.pet-container {
  width: 300px;
  height: 300px;
  /* 将整个容器设置为可拖拽区域 */
  -webkit-app-region: drag;
}

.pet-gif {
  width: 100%;
  height: 100%;
  cursor: pointer;
  user-select: none;
  /* 设置图片为不可拖拽，以便响应点击事件 */
  -webkit-app-region: no-drag;
}

.tooltip {
  position: absolute;
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  white-space: nowrap;
  /* 确保提示框不会干扰拖拽 */
  -webkit-app-region: no-drag;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>