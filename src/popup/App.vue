<template>
  <div class="popup-container">
    <h1>StyleSniffer</h1>
    <p>智能源码样式提取器</p>
    <div class="status">
     状态: <span :class="{ active: isActive }">{{ isActive ? '开启' : '关闭' }}</span>
    </div>
    <button @click="toggleActive">切换开关</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { sendMessage } from 'webext-bridge/popup'

// State should ideally be synchronized with storage, but for now local state
const isActive = ref(false)

const toggleActive = async () => {
  isActive.value = !isActive.value
  
  // Get active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tabs.length > 0 && tabs[0].id) {
    // Send message to content script
    try {
        await sendMessage('toggle-selection', isActive.value, { tabId: tabs[0].id, context: 'content-script' })
    } catch (e) {
        console.error("Failed to send message:", e)
    }
  }
}
</script>

<style scoped>
.popup-container {
  width: 300px;
  padding: 16px;
  font-family: sans-serif;
}
h1 {
  font-size: 18px;
  margin-top: 0;
}
.status {
  margin: 10px 0;
}
.active {
  color: green;
  font-weight: bold;
}
</style>
