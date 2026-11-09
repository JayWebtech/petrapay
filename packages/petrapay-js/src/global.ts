// Script-tag build: <script src="https://unpkg.com/petrapay"></script> exposes window.PetraPay
// and registers the <petrapay-button> element.
import { defineButtonElement } from "./button";
import * as PetraPay from "./index";

defineButtonElement();

declare global {
  interface Window {
    PetraPay: typeof PetraPay;
  }
}

window.PetraPay = PetraPay;
