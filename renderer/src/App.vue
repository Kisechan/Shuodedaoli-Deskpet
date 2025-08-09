<script setup>
import { ref } from "vue";
import petGif from "./assets/pet.gif";
import { Howl } from "howler";

// 配置数据
const tooltips = [
  "说的道理~",
  "尊尼获加",
  "为什么不开大！！",
  "（凤鸣）",
];
const soundFiles = [
  "cnmb.mp3",
  "冲刺，冲.mp3",
  "哎你怎么死了.mp3",
  "哎，猪逼.mp3",
  "啊啊啊我草你妈呀.mp3",
  "嘟嘟嘟.mp3",
  "韭菜盒子.mp3",
  "哇袄.mp3",
];

// 状态管理
const showTooltip = ref(false);
const currentTooltip = ref("");

// 点击事件处理
const handleClick = async () => {
  const randomSoundFile =
    soundFiles[Math.floor(Math.random() * soundFiles.length)];
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

  currentTooltip.value = tooltips[Math.floor(Math.random() * tooltips.length)];
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