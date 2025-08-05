<script setup>
import { ref, onMounted } from 'vue'
import petVideo from './assets/pet.mp4'

const tooltips = [
  "说的道理",
]
const sounds = [
  
]

const showTooltip = ref(false)
const currentTooltip = ref('')

const handleClick = () => {
  // 随机播放音效
  const sound = sounds[Math.floor(Math.random() * sounds.length)]
  window.electronAPI.playSound(sound)
  
  // 随机显示提示
  showTooltip.value = true
  currentTooltip.value = tooltips[Math.floor(Math.random() * tooltips.length)]
  setTimeout(() => showTooltip.value = false, 2000)
}
</script>

<template>
  <div class="container">
    <!-- MP4素材播放 -->
    <video 
      autoplay loop muted 
      :src="petVideo" 
      @click="handleClick"
    />
    
    <!-- 文字提示框 -->
    <transition name="fade">
      <div v-if="showTooltip" class="tooltip">
        {{ currentTooltip }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}

.tooltip {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>