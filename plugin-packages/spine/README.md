# Galacean Effects Spine Plugin

## Usage

### Simple Import

``` ts
import { Player } from '@galacean/effects';
import '@galacean/effects-plugin-spine';
```

### Get Spine Resource List

``` ts
import type { SpineResource } from '@galacean/effects-plugin-spine';

const comp = await player.play(scene);
const spineData: SpineResource[] = comp.loaderData.spineDatas;
```

### Get Animation List / Skin List

1. Get using functions

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name)
const { skeletonData } = item.spineDataCache;
const animationList = getAnimationList(skeletonData);
const skinList = getSkinList(skeletonData);
```

2. Get from the `spineDatas` array

``` ts
const comp = await new Player().loadScene(scene);
const { skinList, animationList } = comp.loaderData.spineDatas[index];
```

### Get Duration of a Specific Animation

``` ts
const animationDuration = getAnimationDuration(skeletonData, animationName);
```

### Get Texture Creation Options
``` ts
import { getTextureOptions } from '@galacean/effects-plugin-spine';

const { magFilter, minFilter, wrapS, wrapT, pma } = getTextureOptions(atlasBuffer);
```

### Set Animation Mix Duration

1. Set default mix duration for an animation (should be called before `player.play`)

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setDefaultMixDuration(mix);
```

2. Set mix duration for a specific transition (should be called before `player.play`)

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setMixDuration(animationOut, animationIn, mix);
```

### Set Playback Speed

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setSpeed(speed);
```

### Set Animation

1. Set a single animation

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);

item.setAnimation(animationName, speed);
```

2. Set a group of animations

``` ts
const comp = await new Player().loadScene(scene);
const item = comp.getItemByName(name);
const animationList = [animationName1, animationName2, animationName3];

item.setAnimation(animationList, speed);
```

## Development

### Getting Started

``` bash
# demo
pnpm --filter @galacean/effects-plugin-spine dev
```

> Open in browser: http://localhost:8081/demo/

## Frame Comparison Testing

> Open in browser: http://localhost:8081/test/
