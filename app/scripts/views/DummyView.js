import {bind} from 'hyperHTML';

/**
 * A sample dummy
 */
export default class DummyView {
  /**
   * Default constructor for setting the values
   *
   * @param {HTMLElement} element - The HTML element to bind/adopt
   */
  constructor(element) {
    this.element = element;
  }

  /**
   * Renders the player.
   *
   * @return {HTMLElement} The rendered element
   */
  render() {
    console.log(`Render DummyView`);

    return bind(this.element)`
      <div class="mdc-card">
        <section class="mdc-card__primary">
          <h1 class="mdc-card__title mdc-card__title--large">Title goes here</h1>
          <h2 class="mdc-card__subtitle">Subtitle here</h2>
        </section>
        <section class="mdc-card__supporting-text">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat.
        </section>
        <section class="mdc-card__actions">
          <button class="mdc-button mdc-button--compact mdc-card__action">Action 1</button>
          <button class="mdc-button mdc-button--compact mdc-card__action">Action 2</button>
        </section>
      </div>
    `;
  }
}
