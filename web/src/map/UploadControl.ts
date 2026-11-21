import { PopupControl } from './PopupControl'

const FOLDER_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>' +
  // Cut-out so the arrows sit on top of the folder outline.
  '<rect x="10" y="9" width="14" height="15" fill="#fff" stroke="none"/>' +
  '<path d="M15 22v-9m-2 2 2-2 2 2"/>' +
  '<path d="M20 13v9m-2-2 2 2 2-2"/>' +
  '</svg>'

export class UploadControl extends PopupControl {
  constructor() {
    super({ id: 'upload-panel', title: 'Faili üleslaadimine', icon: FOLDER_ICON })
  }

  protected panelContent(): HTMLElement[] {
    return []
  }
}
