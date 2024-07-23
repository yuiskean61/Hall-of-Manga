document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("form.add-to-cart").forEach((form) => {
    form.addEventListener("submit", function (e) {
      e.preventDefault(); // Prevent the form from submitting in the traditional way

      const formData = new FormData(this);
      const mangaTitle = formData.get("title"); // Make sure 'title' is correctly named in your form

      fetch("/add-to-cart", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          // Create a central notification
          const notification = document.createElement("div");
          notification.textContent = `You have successfully added "${mangaTitle}" to your cart!`;
          notification.style.position = "fixed";
          notification.style.top = "50%";
          notification.style.left = "50%";
          notification.style.transform = "translate(-50%, -50%)";
          notification.style.backgroundColor = "#f8d7da";
          notification.style.color = "#721c24";
          notification.style.padding = "20px";
          notification.style.borderRadius = "5px";
          notification.style.zIndex = "1000";
          notification.style.border = "1px solid #f5c6cb";

          document.body.appendChild(notification);

          // Remove the notification after 3 seconds
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 3000);
        })
        .catch((error) => {
          console.error("There was a problem with the fetch operation:", error);
        });
    });
  });
});
