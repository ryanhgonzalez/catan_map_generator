// ui.js – Enhanced vanilla jQuery-like helper for catan.js

function $(selectorOrElement) {
  let elements;
  
  if (typeof selectorOrElement === "string") {
    elements = Array.from(document.querySelectorAll(selectorOrElement));
  } else if (selectorOrElement instanceof Element) {
    elements = [selectorOrElement];
  } else {
    elements = [];
  }

  // Create a wrapper object that acts like jQuery
  const wrapper = Object.assign(elements, {
    // Element access via index (e.g., $("button")[0])
    // This is already handled by the array structure
    
    // .click(handler)
    click(handler) {
      elements.forEach((el) => el.addEventListener("click", handler));
      return wrapper;
    },
    
    // .attr(name, value)
    attr(name, value) {
      if (value === undefined) {
        return elements[0] ? elements[0].getAttribute(name) : null;
      }
      elements.forEach((el) => el.setAttribute(name, value));
      return wrapper;
    },
    
    // .width() - returns clientWidth of first element
    width() {
      return elements[0] ? elements[0].clientWidth : 0;
    },
    
    // .height() - returns clientHeight of first element
    height() {
      return elements[0] ? elements[0].clientHeight : 0;
    },
    
    // .val() - get/set value of form elements
    val(value) {
      if (value === undefined) {
        return elements[0] ? elements[0].value : null;
      }
      elements.forEach((el) => {
        el.value = value;
      });
      return wrapper;
    }
  });

  return wrapper;
}

// When DOM is ready, run the existing init() from catan.js
document.addEventListener("DOMContentLoaded", () => {
  // Initialize board history
  window.boardHistory = [];
  window.currentBoardIndex = -1;
  
  if (typeof init === "function") {
    init();
    
    // Hide loading overlay after a brief delay to let first render complete
    setTimeout(() => {
      const mapLoading = document.getElementById("map-loading-state");
      if (mapLoading) {
        mapLoading.style.opacity = "0";
        mapLoading.style.transition = "opacity 300ms ease-out";
        mapLoading.style.pointerEvents = "none";
        setTimeout(() => {
          mapLoading.remove();
        }, 300);
      }
    }, 500);
  }
});
