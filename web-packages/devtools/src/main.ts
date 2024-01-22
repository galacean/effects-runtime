import { createApp } from 'vue';

import App from './App.vue';

import './styles/index.scss';
import '@advjs/gui/client/styles/index.scss';
import '@advjs/gui/dist/icons.css';

import '@unocss/reset/tailwind.css';
import 'uno.css';

createApp(App).mount('#app');
