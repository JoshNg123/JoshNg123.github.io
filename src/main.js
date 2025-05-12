import { connectWalletAndInitContract } from "./detect.js";
import { loadCampaigns } from "./campaign.js";

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded");
  if (window.localStorage.getItem("walletConnected") === "true") {
    console.log("Wallet already connected");

    try {
      await connectWalletAndInitContract();
      await loadCampaigns();
    } catch (e) {
      window.localStorage.removeItem("walletConnected");
    }
  }
});

document
  .querySelector(".disconnectEthereumButton")
  .addEventListener("click", () => {
    window.localStorage.removeItem("walletConnected");
    document.querySelector(".showAccount").textContent = "";
    document.querySelector(".campaign-list").innerHTML = "";
  });

document
  .querySelector(".enableEthereumButton")
  .addEventListener("click", async () => {
    try {
      await connectWalletAndInitContract();
      await loadCampaigns();
    } catch (err) {
      alert("Wallet connection failed");
    }
  });

