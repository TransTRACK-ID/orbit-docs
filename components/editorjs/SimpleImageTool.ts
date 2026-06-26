import { isLoadableImageUrl } from "~/composables/useEditorJsConverter";
import BaseSimpleImage from "@editorjs/simple-image";

export default class SimpleImageTool extends BaseSimpleImage {
  render() {
    const wrapper = this._make("div", [this.CSS.baseClass, this.CSS.wrapper]);
    const loader = this._make("div", this.CSS.loading);
    const imageHolder = this._make("div", this.CSS.imageHolder);
    const image = this._make("img");
    const caption = this._make("div", [this.CSS.input, this.CSS.caption], {
      contentEditable: !this.readOnly,
      innerHTML: this.data.caption || "",
    });

    caption.dataset.placeholder = "Enter a caption";
    wrapper.appendChild(loader);

    // Nodes must be registered before any broken-state / onload callback runs,
    // because _acceptTuneView() reads this.nodes.imageHolder.
    this.nodes.imageHolder = imageHolder;
    this.nodes.wrapper = wrapper;
    this.nodes.image = image;
    this.nodes.caption = caption;

    const finishLayout = () => {
      wrapper.classList.remove(this.CSS.loading);
      loader.remove();
      if (!imageHolder.contains(image)) {
        imageHolder.appendChild(image);
      }
      if (!wrapper.contains(imageHolder)) {
        wrapper.appendChild(imageHolder);
      }
      if (!wrapper.contains(caption)) {
        wrapper.appendChild(caption);
      }
      this._acceptTuneView();
    };

    const showBrokenState = (message: string) => {
      finishLayout();
      image.alt = message;
      image.removeAttribute("src");
      imageHolder.classList.add("cdx-simple-image__picture--broken");
      const hint = this._make("div", "cdx-simple-image__error");
      hint.textContent = message;
      if (!wrapper.querySelector(".cdx-simple-image__error")) {
        wrapper.insertBefore(hint, caption);
      }
    };

    const url = (this.data.url || "").trim();
    if (!url) {
      showBrokenState("Paste an image or enter an image URL.");
    } else if (!isLoadableImageUrl(url)) {
      const label = this.data.caption || url;
      showBrokenState(`Could not load "${label}". Re-paste the GIF from Notion or copy the image directly.`);
    } else {
      image.onload = () => finishLayout();
      image.onerror = () => showBrokenState("Image failed to load. Re-paste or update the URL.");
      image.src = url;
    }

    return wrapper;
  }
}
