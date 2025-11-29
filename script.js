/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-id="${product.id}" data-name="${product.name}" data-brand="${product.brand}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <div class="product-description">
        <p>${product.description}</p>
      </div>
    </div>
  `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Get reference to the search input field */
const searchInput = document.getElementById("searchInput");

/* Function to filter products by category and search keyword */
function filterProducts() {
  const selectedCategory = categoryFilter.value;
  const searchKeyword = searchInput.value.trim().toLowerCase();

  loadProducts().then((products) => {
    let filteredProducts = products;

    // Filter by category if a category is selected
    if (selectedCategory) {
      filteredProducts = filteredProducts.filter(
        (product) => product.category === selectedCategory
      );
    }

    // Further filter by search keyword
    if (searchKeyword) {
      filteredProducts = filteredProducts.filter((product) =>
        `${product.name} ${product.brand} ${product.description}`
          .toLowerCase()
          .includes(searchKeyword)
      );
    }

    // Display the filtered products
    displayProducts(filteredProducts);
  });
}

/* Event listeners for category filter and search input */
categoryFilter.addEventListener("change", filterProducts);
searchInput.addEventListener("input", filterProducts);

/* Small helper to escape HTML so user/assistant messages are safe to insert */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* Array to store the conversation history */
let conversationHistory = [];

/* Function to add context to the conversation */
function addContextToHistory(role, content) {
  conversationHistory.push({ role, content });
}

/* Chat form submission handler - sends messages to Cloudflare Worker endpoint
   Tracks context for multi-turn interactions. */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const inputEl = document.getElementById("userInput");
  const userText = inputEl.value.trim();
  if (!userText) return;

  // Insert user's message as a right-aligned bubble
  const userHtml = `
    <div class="chat-message user">
      <div class="message-bubble">
        <div class="message-text">${escapeHtml(userText)}</div>
      </div>
    </div>
  `;
  chatWindow.insertAdjacentHTML("beforeend", userHtml);
  inputEl.value = "";

  // Add the user's message to the conversation history
  addContextToHistory("user", userText);

  // Add a typing indicator bubble for the assistant
  const typingId = `typing-${Date.now()}`;
  const typingHtml = `
    <div class="chat-message assistant typing" id="${typingId}">
      <div class="message-bubble">
        <div class="message-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  chatWindow.insertAdjacentHTML("beforeend", typingHtml);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Build messages array (system + conversation history)
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant that provides advice and answers questions only about skincare, haircare, makeup, fragrance, and related topics. You can also answer questions about the generated routine. Do not respond to unrelated topics.",
      },
      ...conversationHistory,
    ];

    // Send request to the OpenAI API
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      throw new Error(`Network error: ${res.status}`);
    }

    const data = await res.json();

    // Remove typing indicator
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    // Extract assistant text from data.choices[0].message.content
    let assistantText = "";
    if (
      data &&
      Array.isArray(data.choices) &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      assistantText = data.choices[0].message.content;
    } else {
      assistantText =
        "Sorry, I couldn't process your request. Please try again.";
    }

    // Add the assistant's message to the conversation history
    addContextToHistory("assistant", assistantText);

    // Insert assistant's message as a left-aligned bubble
    const assistantHtml = `
      <div class="chat-message assistant">
        <div class="message-bubble">
          <div class="message-text">${escapeHtml(assistantText)}</div>
        </div>
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", assistantHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (err) {
    // Remove typing indicator if present and show error as assistant message
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const errorHtml = `
      <div class="chat-message assistant">
        <div class="message-bubble">
          <div class="message-text">Request failed: ${escapeHtml(
            err.message
          )}</div>
        </div>
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", errorHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});

// Array to store selected products
let selectedProducts = [];

// Function to save selected products to localStorage
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

// Function to load selected products from localStorage
function loadSelectedProducts() {
  const savedProducts = localStorage.getItem("selectedProducts");
  if (savedProducts) {
    selectedProducts = JSON.parse(savedProducts);
    updateSelectedProductsList();
    // Highlight the previously selected product cards
    selectedProducts.forEach((product) => {
      const productCard = productsContainer.querySelector(
        `.product-card[data-id="${product.id}"]`
      );
      if (productCard) {
        productCard.classList.add("selected");
      }
    });
  }
}

// Call loadSelectedProducts when the page loads
window.addEventListener("load", loadSelectedProducts);

// Function to render the selected products list
function updateSelectedProductsList() {
  selectedProductsList.innerHTML = ""; // Clear the list
  selectedProducts.forEach((product) => {
    const productItem = document.createElement("div");
    productItem.classList.add("selected-product-item");
    productItem.innerHTML = `
      <span>${product.brand} - ${product.name}</span>
      <button class="remove-btn" data-id="${product.id}">&times;</button>
    `;
    selectedProductsList.appendChild(productItem);
  });
  saveSelectedProducts(); // Save the updated list to localStorage
}

// Event listener for product selection
productsContainer.addEventListener("click", (event) => {
  const productCard = event.target.closest(".product-card");
  if (!productCard) return;

  const productId = productCard.dataset.id;
  const productName = productCard.dataset.name;
  const productBrand = productCard.dataset.brand; // Add brand data attribute

  // Check if the product is already selected
  const productIndex = selectedProducts.findIndex((p) => p.id === productId);

  if (productIndex === -1) {
    // Add product to the selected list
    selectedProducts.push({
      id: productId,
      name: productName,
      brand: productBrand,
    });
    productCard.classList.add("selected"); // Highlight the product
  } else {
    // Remove product from the selected list
    selectedProducts.splice(productIndex, 1);
    productCard.classList.remove("selected"); // Remove highlight
  }

  updateSelectedProductsList(); // Update the selected products section
});

// Event listener to remove products directly from the selected list
selectedProductsList.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-btn")) return;

  const productId = event.target.dataset.id;

  // Remove product from the selected list
  selectedProducts = selectedProducts.filter(
    (product) => product.id !== productId
  );

  // Remove highlight from the product card
  const productCard = productsContainer.querySelector(
    `.product-card[data-id="${productId}"]`
  );
  if (productCard) {
    productCard.classList.remove("selected");
  }

  updateSelectedProductsList(); // Update the selected products section
});

// Get reference to the "Generate Routine" button
const generateRoutineButton = document.getElementById("generateRoutine");

// Event listener for "Generate Routine" button
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    // If no products are selected, display a message in the chat window
    const noProductsHtml = `
      <div class="chat-message assistant">
        <div class="message-bubble">
          <div class="message-text">Please select some products to generate a routine.</div>
        </div>
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", noProductsHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return;
  }

  // Prepare the message for the OpenAI API
  const productDetails = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant that creates personalized skincare and beauty routines based on the provided products. Keep the routine concise and easy to follow.",
    },
    {
      role: "user",
      content: `Here are the selected products: ${JSON.stringify(
        productDetails
      )}. Please create a personalized routine.`,
    },
  ];

  // Add a typing indicator in the chat window
  const typingId = `typing-${Date.now()}`;
  const typingHtml = `
    <div class="chat-message assistant typing" id="${typingId}">
      <div class="message-bubble">
        <div class="message-dots"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  chatWindow.insertAdjacentHTML("beforeend", typingHtml);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    // Send the request to the OpenAI API
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      throw new Error(`Network error: ${res.status}`);
    }

    const data = await res.json();

    // Remove the typing indicator
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    // Extract the AI-generated routine
    let routine = "";
    if (
      data &&
      Array.isArray(data.choices) &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      routine = data.choices[0].message.content;
    } else {
      routine = "Sorry, I couldn't generate a routine. Please try again.";
    }

    // Display the routine in the chat window
    const routineHtml = `
      <div class="chat-message assistant">
        <div class="message-bubble">
          <div class="message-text">${escapeHtml(routine)}</div>
        </div>
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", routineHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (err) {
    // Remove the typing indicator and display an error message
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    const errorHtml = `
      <div class="chat-message assistant">
        <div class="message-bubble">
          <div class="message-text">Request failed: ${escapeHtml(
            err.message
          )}</div>
        </div>
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", errorHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});

/* Function to apply RTL or LTR mode based on the selected language */
function applyLanguageDirection(language) {
  const htmlElement = document.documentElement;

  if (language === "ar" || language === "he") {
    // Apply RTL mode for Arabic, Hebrew, or other RTL languages
    htmlElement.setAttribute("dir", "rtl");
    document.body.style.direction = "rtl";
  } else {
    // Apply LTR mode for other languages
    htmlElement.setAttribute("dir", "ltr");
    document.body.style.direction = "ltr";
  }
}

/* Example: Detect language change (you can replace this with your own logic) */
const languageSelector = document.getElementById("languageSelector");
if (languageSelector) {
  languageSelector.addEventListener("change", (event) => {
    const selectedLanguage = event.target.value;
    applyLanguageDirection(selectedLanguage);
  });
}

// Set default language direction on page load
window.addEventListener("load", () => {
  const defaultLanguage = "en"; // Set your default language here
  applyLanguageDirection(defaultLanguage);
});
