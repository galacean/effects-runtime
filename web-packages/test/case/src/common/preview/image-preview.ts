import { buildMergedPreviewDataURL } from './merged-preview';

type ViewerToolbarOptions = {
  zoomIn?: number | boolean,
  zoomOut?: number | boolean,
  oneToOne?: number | boolean,
  reset?: number | boolean,
  prev?: number | boolean,
  play?: number | boolean,
  next?: number | boolean,
  rotateLeft?: number | boolean,
  rotateRight?: number | boolean,
  flipHorizontal?: number | boolean,
  flipVertical?: number | boolean,
};

type ViewerOptions = {
  inline?: boolean,
  navbar?: boolean,
  title?: boolean,
  toolbar?: boolean | ViewerToolbarOptions,
  backdrop?: boolean | 'static',
  transition?: boolean,
  movable?: boolean,
  zoomable?: boolean,
  zoomRatio?: number,
  maxZoomRatio?: number,
  keyboard?: boolean,
};

type ViewerInstance = {
  show?: () => void,
  destroy?: () => void,
};

type ViewerConstructor = new (element: HTMLElement, options?: ViewerOptions) => ViewerInstance;

type ZoomableImage = HTMLImageElement & {
  __previewBound?: boolean,
  __viewerInstance?: ViewerInstance,
};

export type SavePreviewImageOptions = {
  filename: string,
  idx: [number, number],
  url: string,
  isNew?: boolean,
  imageClassName?: string,
  note?: string,
};

export class CaseImagePreview {
  async saveImage (options: SavePreviewImageOptions) {
    const { filename, idx, url, isNew, imageClassName, note } = options;
    const img = document.createElement('img');
    const suite = document.querySelectorAll('.suite');
    const ul = suite[idx[0]]?.querySelector('ul');
    let li = ul?.querySelector(`li.idx-${idx[1]}`);

    if (!ul) {
      return;
    }

    if (!li) {
      const div = document.createElement('div');

      div.classList.add('image-cell');
      li = document.createElement('li');
      li.classList.add('idx');
      li.classList.add(`idx-${idx[1]}`);
      li.appendChild(div);
    }

    const div = li.querySelector('div.image-cell');

    if (!div) {
      return;
    }

    const sampleKey = this.getSampleKey(filename);
    const groupType = this.getImageGroupType(filename, isNew, imageClassName);
    let groupContainer: HTMLElement | null = null;

    div.querySelectorAll<HTMLElement>('.comparison-group').forEach(item => {
      if (item.dataset.sampleKey === sampleKey) {
        groupContainer = item;
      }
    });

    if (!groupContainer) {
      groupContainer = this.createComparisonGroup(sampleKey);
      div.appendChild(groupContainer);
    }

    const groupWrap = groupContainer.querySelector<HTMLElement>('.image-group-wrap');
    const targetGroup = groupWrap?.querySelector<HTMLElement>(`.image-group[data-group="${groupType}"]`);
    const slot = targetGroup?.querySelector<HTMLElement>('.image-slot');
    const noteEl = groupWrap?.querySelector<HTMLElement>('.image-note');

    if (!slot) {
      return;
    }

    slot.innerHTML = '';

    img.title = filename;
    img.src = url;
    img.classList.add('previewable-image');
    if (imageClassName) {
      img.classList.add(imageClassName);
    }
    this.bindImageZoom(img);

    slot.appendChild(img);
    if (noteEl) {
      noteEl.textContent = note || '';
    }

    if (groupType === 'heatmap') {
      const mergedPreviewDataURL = await buildMergedPreviewDataURL(groupContainer);

      if (mergedPreviewDataURL) {
        this.bindFullPreviewLink(groupContainer, mergedPreviewDataURL);
      }
    }

    ul.appendChild(li);
  }

  private getImageGroupType (filename: string, isNew?: boolean, imageClassName?: string): 'old' | 'new' | 'heatmap' {
    if (imageClassName?.includes('diff-heatmap') || /_diff\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return 'heatmap';
    }
    if (isNew || /_new\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      return 'new';
    }

    return 'old';
  }

  private getSampleKey (filename: string) {
    return filename
      .replace(/\.(png|jpg|jpeg|webp)$/i, '')
      .replace(/_(old|new|diff|compare)$/i, '');
  }

  private createImageGroupTemplate (group: 'old' | 'new' | 'heatmap', title: string) {
    return `
<section class="image-group" data-group="${group}">
  <div class="image-group-title">${title}</div>
  <div class="image-slot"></div>
</section>`;
  }

  private createComparisonGroup (sampleKey: string) {
    const container = document.createElement('div');

    container.classList.add('comparison-group');
    container.dataset.sampleKey = sampleKey;
    container.innerHTML = `
<div class="image-group-wrap">
  <a class="full-preview-link" href="#" aria-label="全预览">全预览</a>
  ${this.createImageGroupTemplate('old', 'OLD')}
  ${this.createImageGroupTemplate('new', 'NEW')}
  ${this.createImageGroupTemplate('heatmap', 'HEATMAP')}
  <small class="image-note"></small>
  <img class="full-preview-target" alt="full-preview" />
</div>`;

    return container;
  }

  private getViewerConstructor () {
    const maybeViewer = (window as Window & { Viewer?: unknown }).Viewer;

    if (typeof maybeViewer !== 'function') {
      return null;
    }

    return maybeViewer as unknown as ViewerConstructor;
  }

  private bindImageZoom (img: HTMLImageElement) {
    const Viewer = this.getViewerConstructor();
    const target = img as ZoomableImage;

    if (!Viewer || target.__previewBound) {
      return;
    }

    target.__previewBound = true;
    target.__viewerInstance = new Viewer(target, {
      inline: false,
      navbar: false,
      title: true,
      backdrop: true,
      transition: false,
      movable: true,
      zoomable: true,
      keyboard: false,
      zoomRatio: 0.2,
      maxZoomRatio: 50,
      toolbar: {
        zoomIn: 1,
        zoomOut: 1,
        oneToOne: 1,
        reset: 1,
        prev: 0,
        play: 0,
        next: 0,
        rotateLeft: 0,
        rotateRight: 0,
        flipHorizontal: 0,
        flipVertical: 0,
      },
    });

    target.addEventListener('click', () => {
      target.__viewerInstance?.show?.();
    });
  }

  private bindFullPreviewLink (groupContainer: HTMLElement, dataUrl: string) {
    const link = groupContainer.querySelector<HTMLAnchorElement>('.full-preview-link');
    const target = groupContainer.querySelector<HTMLImageElement>('.full-preview-target') as ZoomableImage | null;

    if (!link || !target || !dataUrl) {
      return;
    }

    target.src = dataUrl;
    this.bindImageZoom(target);
    link.style.display = 'inline-block';
    link.onclick = event => {
      event.preventDefault();
      target.__viewerInstance?.show?.();
    };
  }
}
