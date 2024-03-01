# Galacean Effects 骨骼动画插件

## 使用

### 简单引入

``` ts
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
```

### 获取 spine 资源列表

``` ts
import type { SpineResource } from '@galacean/effects-plugin-spine';

const comp = await player.play(scene);
const spineData: SpineResource[] = comp.loaderData.spineDatas;
```

### 获取动画列表/皮肤列表

1. 使用函数获取

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name)
const { skeletonData } = item.spineDataCache;
const animationList = getAnimationList(skeletonData);
const skinList = getSkinList(skeletonData);
```

2. 在 `spineDatas` 数组中获取

``` ts
const comp = await new Player().loadScene(scene);
const { skinList, animationList } = comp.loaderData.spineDatas[index];
```

3. 从 atals 和 skeleton 二进制数据中获取
```ts
const atlas = getAtlasFromBuffer(atlasBuffer);
const skeletonFile = getSkeletonFromBuffer(skeletonBuffer, skeletonType);
const skeletonData = createSkeletonData(atlas, skeletonFile, skeletonType);
const skinList = getSkinList(skeletonData);
const animationList = getAnimationList(skeletonData);
```

### 获取指定动画时长

``` ts
const animationDuration = getAnimationDuration(skeletonData, animationName);
```

### 获取创建纹理的参数
``` ts
import { getTextureOptions } from '@galacean/effects-plugin-spine';

const { magFilter, minFilter, wrapS, wrapT, pma } = getTextureOptions(atlasBuffer);
```

### 设置动画 mix 时间

1. 设置动画的默认 mix 时间 （需要在 `player.play`` 前调用）

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setDefaultMixDuration(mix);
```

2. 设置指定动作的 mix 时间 （需要在 `player.play`` 前调用）

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setMixDuration(animationOut, animationIn, mix);
```
### 设置播放速度

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setSpeed(speed);
```

### 设置动画

1. 设置单个动画
``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setAnimation(animationName, speed);
```

2. 设置一组动画

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);
const animationList = [animationName1, animationName2, animationName3];

item.setAnimation(animationList, speed);
```

## 本地开发

### 开始开发

``` bash
# demo
pnpm --filter @galacean/effects-plugin-spine dev
```

> 浏览器打开：http://localhost:8081/demo/

## 帧对比测试

> 浏览器打开：http://localhost:8081/test/
