// public/js/main.js
const ALLOWED_RADIUS_KM = 10;

// Read configuration from the hidden div
const configEl = document.getElementById("config");
const CENTRE_LAT = parseFloat(configEl.dataset.centreLat);
const CENTRE_LON = parseFloat(configEl.dataset.centreLon);

const messageEl = document.getElementById("message");
const buttonDiv = document.getElementById("whatsapp-button");
const whatsappLink = document.getElementById("whatsapp-link");

if (!navigator.geolocation) {
  messageEl.textContent = "Geolocation is not supported by your browser.";
} else {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;

      const distance = haversineDistance(
        userLat,
        userLon,
        CENTRE_LAT,
        CENTRE_LON,
      );

      if (distance <= ALLOWED_RADIUS_KM) {
        fetch("/api/whatsapp-number")
          .then((response) => response.json())
          .then((data) => {
            if (data.number) {
              whatsappLink.href = `https://wa.me/${data.number}`;
              buttonDiv.style.display = "block";
              messageEl.textContent = `You are within ${distance.toFixed(1)} km of our centre. Click the button to chat!`;
            } else {
              messageEl.textContent =
                "WhatsApp contact is currently unavailable.";
            }
          })
          .catch(() => {
            messageEl.textContent = "Error fetching contact information.";
          });
      } else {
        messageEl.textContent = `Sorry, you are ${distance.toFixed(1)} km away. Our service area is within ${ALLOWED_RADIUS_KM} km.`;
      }
    },
    (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          messageEl.textContent =
            "Location access denied. Please enable location to check if you are in our service area.";
          break;
        case error.POSITION_UNAVAILABLE:
          messageEl.textContent = "Location information is unavailable.";
          break;
        case error.TIMEOUT:
          messageEl.textContent = "Location request timed out.";
          break;
        default:
          messageEl.textContent = "An unknown error occurred.";
      }
    },
  );
}

// Haversine formula to calculate distance in km
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
