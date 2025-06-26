import { createApp } from "vue";
import App from "./App.vue";
import { GHL } from "./ghl";
import { supabase } from "./supabase";

const ghl = new GHL();
window.ghl = ghl;
window.supabase = supabase;

createApp(App).mount("#app");