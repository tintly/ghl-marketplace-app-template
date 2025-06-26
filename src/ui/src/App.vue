<template>
  <div id="app">
    <DataExtractorApp />
  </div>
</template>

<script>
import DataExtractorApp from './components/DataExtractorApp.vue'

export default {
  name: 'App',
  components: {
    DataExtractorApp
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  background: #f8fafc;
}
</style>