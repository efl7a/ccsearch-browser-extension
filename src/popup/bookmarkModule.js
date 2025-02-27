import { elements } from './base';
import { activatePopup } from './infoPopupModule';
import { providerLogos, unicodeToString } from './helper';
// eslint-disable-next-line import/no-cycle
import { removeOldSearchResults, removeLoaderAnimation } from './searchModule';
import { addSpinner, removeSpinner } from './spinner';
import {
  showNotification, removeNode, restoreInitialContent, removeChildNodes,
} from '../utils';

const Masonry = require('masonry-layout');

export default function bookmarkImage(e) {
  chrome.storage.sync.get({ bookmarks: [] }, (items) => {
    const bookmarksArray = items.bookmarks;
    if (bookmarksArray.indexOf(e.target.dataset.imageid) === -1) {
      bookmarksArray.push(e.target.dataset.imageid);
      chrome.storage.sync.set({ bookmarks: bookmarksArray }, () => {
        showNotification('Image Bookmarked', 'positive', 'snackbar-bookmarks');
      });
    } else {
      showNotification('Image already bookmarked!', 'negative', 'snackbar-bookmarks');
    }
  });
}

function removeBookmark(e) {
  const imageId = e.target.dataset.imageid;
  chrome.storage.sync.get({ bookmarks: [] }, (items) => {
    const bookmarksArray = items.bookmarks;

    const bookmarkIndex = bookmarksArray.indexOf(imageId);
    bookmarksArray.splice(bookmarkIndex, 1);

    let isLastImage = false;
    if (bookmarksArray.length === 0) {
      isLastImage = true;
    }

    chrome.storage.sync.set({ bookmarks: bookmarksArray }, () => {
      const imageDiv = document.getElementById(`id_${imageId}`);
      imageDiv.parentElement.removeChild(imageDiv);
      // eslint-disable-next-line no-use-before-define
      msnry.layout(); // layout grid again
      showNotification('Bookmark removed', 'positive', 'snackbar-bookmarks');

      if (isLastImage) {
        restoreInitialContent('bookmarks');
      }
    });
  });
}

function appendToGrid(msnry, fragment, e, grid) {
  grid.appendChild(fragment);
  msnry.appended(e);
  // eslint-disable-next-line no-undef
  imagesLoaded(grid).on('progress', () => {
    // layout Masonry after each image loads
    msnry.layout();
  });
}

const msnry = new Masonry(elements.gridBookmarks, {
  // options
  itemSelector: '.grid-item',
  columnWidth: '.grid-item',
  gutter: '.gutter-sizer',
  percentPosition: true,
  transitionDuration: '0',
});

function loadImages() {
  chrome.storage.sync.get({ bookmarks: [] }, (items) => {
    const bookmarksArray = items.bookmarks;
    if (bookmarksArray.length > 0) {
      removeNode('bookmarks__initial-info');
    } else {
      removeSpinner(elements.spinnerPlaceholderBookmarks);
      restoreInitialContent('bookmarks');
    }

    // get the details of each image

    bookmarksArray.forEach((imageId) => {
      const url = `http://api.creativecommons.engineering/image/${imageId}`;
      fetch(url)
        .then(data => data.json())
        .then((res) => {
          const fragment = document.createDocumentFragment();

          const thumbnail = res.thumbnail ? res.thumbnail : res.url;
          const title = unicodeToString(res.title);
          const { license, id } = res;
          const provider = res.provider_code.toLowerCase();
          const licenseArray = license.split('-'); // split license in individual characteristics
          const foreignLandingUrl = res.foreign_landing_url;

          // make an image element
          const imgElement = document.createElement('img');
          imgElement.setAttribute('src', thumbnail);
          imgElement.setAttribute('class', 'image-thumbnails');
          imgElement.setAttribute('id', id);

          // make a span to hold the title
          const spanTitleElement = document.createElement('span');
          spanTitleElement.setAttribute('class', 'image-title');
          spanTitleElement.setAttribute('title', title);
          const imageTitleNode = document.createTextNode(title);

          // make a link to foreign landing page of image
          const foreignLandingLinkElement = document.createElement('a');
          foreignLandingLinkElement.setAttribute('href', foreignLandingUrl);
          foreignLandingLinkElement.setAttribute('target', '_blank');
          foreignLandingLinkElement.setAttribute('class', 'foreign-landing-url');

          const providerImageElement = document.createElement('img');
          let providerLogoName;
          for (let i = 0; i < providerLogos.length; i += 1) {
            if (providerLogos[i].includes(provider)) {
              providerLogoName = providerLogos[i];
              break;
            }
          }
          providerImageElement.setAttribute('src', `img/provider_logos/${providerLogoName}`);
          providerImageElement.setAttribute('class', 'provider-image');

          foreignLandingLinkElement.appendChild(providerImageElement);
          foreignLandingLinkElement.appendChild(imageTitleNode);

          spanTitleElement.appendChild(foreignLandingLinkElement);

          // make a span to hold the license icons
          const spanLicenseElement = document.createElement('span');
          spanLicenseElement.setAttribute('class', 'image-license');

          // make a link to license description
          const licenseLinkElement = document.createElement('a');
          licenseLinkElement.setAttribute(
            'href',
            `https://creativecommons.org/licenses/${license}/2.0/`,
          );
          licenseLinkElement.setAttribute('target', '_blank'); // open link in new tab
          licenseLinkElement.setAttribute('title', license); // open link in new tab

          // Array to hold license image elements
          const licenseIconElementsArray = [];

          // Add the default cc icon
          let licenseIconElement = document.createElement('img');
          licenseIconElement.setAttribute('src', 'img/license_logos/cc_icon.svg');
          licenseIconElement.setAttribute('alt', 'cc_icon');
          licenseIconElementsArray.push(licenseIconElement);

          // make and push license image elements
          licenseArray.forEach((name) => {
            licenseIconElement = document.createElement('img');
            licenseIconElement.setAttribute('src', `img/license_logos/cc-${name}_icon.svg`);
            licenseIconElement.setAttribute('alt', `cc-${name}_icon`);
            licenseIconElementsArray.push(licenseIconElement);
          });

          licenseIconElementsArray.forEach((licenseIcon) => {
            licenseLinkElement.appendChild(licenseIcon);
          });

          const bookmarkIcon = document.createElement('i');
          bookmarkIcon.classList.add('fa');
          bookmarkIcon.classList.add('fa-bookmark');
          bookmarkIcon.classList.add('bookmark-icon');
          bookmarkIcon.id = 'setting-icon';
          bookmarkIcon.title = 'Remove bookmark';
          bookmarkIcon.setAttribute('data-imageid', id);
          bookmarkIcon.addEventListener('click', removeBookmark);

          spanLicenseElement.appendChild(licenseLinkElement);
          spanLicenseElement.appendChild(bookmarkIcon);

          // make a div element to encapsulate image element
          const divElement = document.createElement('div');
          divElement.setAttribute('class', 'image');
          divElement.id = `id_${imageId}`; // used for searching image div element

          // adding event listener to open popup.
          divElement.addEventListener('click', (e) => {
            if (e.target.classList.contains('image')) {
              const imageThumbnail = e.target.querySelector('.image-thumbnails');
              activatePopup(imageThumbnail);
            }
          });

          divElement.appendChild(imgElement);
          divElement.appendChild(spanTitleElement);
          divElement.appendChild(spanLicenseElement);

          // div to act as grid itemj
          const gridItemDiv = document.createElement('div');
          gridItemDiv.setAttribute('class', 'grid-item');

          gridItemDiv.appendChild(divElement);

          fragment.appendChild(gridItemDiv);

          removeSpinner(elements.spinnerPlaceholderBookmarks);
          appendToGrid(msnry, fragment, gridItemDiv, elements.gridBookmarks);
        });
    });
  });
}

// TODO: use a general function
function removeBookmarkImages() {
  const div = document.createElement('div');
  div.classList.add('gutter-sizer');
  removeChildNodes(elements.gridBookmarks);
  elements.gridBookmarks.appendChild(div);
}

document.addEventListener('DOMContentLoaded', () => {
  elements.showBookmarksIcon.addEventListener('click', () => {
    window.isBookmarksActive = true;

    elements.homeIcon.style.pointerEvents = 'none';
    setTimeout(() => {
      elements.homeIcon.style.pointerEvents = 'auto';
    }, 300);
    elements.primarySection.style.display = 'none';
    elements.bookmarksSection.style.display = 'block';
    // elements.homeIcon.style.visibility = 'visible';
    elements.homeIcon.style.display = 'inline-block';
    elements.showBookmarksIcon.style.display = 'none';
    elements.inputField.value = '';

    addSpinner(elements.spinnerPlaceholderBookmarks);
    removeOldSearchResults();
    removeLoaderAnimation();
    restoreInitialContent('primary');
    loadImages();
  });

  elements.homeIcon.addEventListener('click', (e) => {
    window.isBookmarksActive = false;

    elements.showBookmarksIcon.style.pointerEvents = 'none';
    setTimeout(() => {
      elements.showBookmarksIcon.style.pointerEvents = 'auto';
    }, 300);
    elements.primarySection.style.display = 'block';
    elements.bookmarksSection.style.display = 'none';
    elements.showBookmarksIcon.style.display = 'inline-block';
    e.target.style.display = 'none';

    removeBookmarkImages();
  });

  elements.deleteAllBookmarksButton.addEventListener('click', () => {
    chrome.storage.sync.get({ bookmarks: [] }, (items) => {
      const bookmarksArray = items.bookmarks;
      if (bookmarksArray.length === 0) {
        showNotification('No Bookmarks Available', 'negative', 'snackbar-bookmarks');
      } else {
        bookmarksArray.splice(0, bookmarksArray.length); // empty array
        chrome.storage.sync.set({ bookmarks: bookmarksArray }, () => {
          // restoring initial layout of bookmarks section
          removeBookmarkImages();
          msnry.layout();
          restoreInitialContent('bookmarks');
          // confirm user action
          showNotification('Bookmarks successfully removed', 'positive', 'snackbar-bookmarks');
        });
      }
    });
  });
});
