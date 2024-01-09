import { createApp } from 'vue';
import './style.css';

// @ts-expect-error App
import App from './App.vue';

import '@unocss/reset/tailwind.css';
import 'uno.css';

import './styles/index.scss';
import '@advjs/gui/client/styles/index.scss';
import '@advjs/gui/dist/icons.css';

createApp(App).mount('#app');
