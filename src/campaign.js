// src/campaigns.js

import { getContract } from "./detect.js";
import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.min.js";

let contractInstance;

export async function loadCampaigns() {
  const contract = getContract();
  contractInstance = contract;
  const count = await contract.campaignCount();
  const campaignsEl = document.querySelector(".campaign-list");
  campaignsEl.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const campaign = await contract.campaigns(i);
    const deadline = new Date(
      Number(campaign.deadline) * 1000
    ).toLocaleDateString();
    const card = document.createElement("div");
    card.className = "campaign-card";
    card.innerHTML = `
      <h3>${campaign.title}</h3>
      <p>Deadline: ${deadline}</p>
    `;
    card.onclick = () => showCampaignDetail(i);
    campaignsEl.appendChild(card);
  }
}

export async function showCampaignDetail(campaignId) {
  const contract = contractInstance || getContract();
  const campaign = await contract.campaigns(campaignId);
  const currentUser = await contract.runner.getAddress();

  document.getElementById("detail-title").textContent = campaign.title;
  document.getElementById("detail-description").textContent =
    campaign.description;
  document.getElementById("detail-goal").textContent = `${ethers.formatEther(
    campaign.goal
  )} ETH`;
  document.getElementById("detail-pledged").textContent = `${ethers.formatEther(
    campaign.pledged
  )} ETH`;
  document.getElementById("detail-deadline").textContent = new Date(
    Number(campaign.deadline) * 1000
  ).toLocaleDateString();

  const currentAmount = parseFloat(ethers.formatEther(campaign.pledged));
  const goalAmount = parseFloat(ethers.formatEther(campaign.goal));

  // Fetch milestones
  const milestoneCount = await contract.getMilestoneCount(campaignId);
  let milestones = [];
  for (let i = 0; i < milestoneCount; i++) {
    const [desc, target] = await contract.getMilestone(campaignId, i);
    milestones.push({
      label: desc,
      value: parseFloat(ethers.formatEther(target)),
    });
  }

  // Clear and set up the progress bar container
  const container = document.getElementById("progress-bar-container");
  container.innerHTML = "";
  container.style.position = "relative";

  // Create the ProgressBar
  const bar = new ProgressBar.Line("#progress-bar-container", {
    strokeWidth: 8,
    color: "#9c27b0",
    trailColor: "#eee",
    trailWidth: 8,
    svgStyle: { width: "100%", height: "30px" },
    easing: "easeInOut",
    duration: 1400,
  });

  // Animate the progress bar to current progress (0 to 1)
  const progressRatio = Math.min(currentAmount / goalAmount, 1);
  bar.animate(progressRatio);

  // Helper to add a marker
  function addMarker(positionRatio, color, label, amount, isBold = false) {
    const marker = document.createElement("div");
    marker.style.position = "absolute";
    marker.style.left = `${positionRatio * 100}%`;
    marker.style.top = "6px";
    marker.style.transform = "translate(-50%, 0)";
    marker.style.display = "flex";
    marker.style.flexDirection = "column";
    marker.style.alignItems = "center";
    marker.style.pointerEvents = "none";

    marker.innerHTML = `
      <div style="
        background: ${color};
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid #fff;
        box-shadow: 0 2px 6px #0001;
        margin-bottom: 4px;
      "></div>
      <div style="margin-top: 8px; font-weight: ${
        isBold ? "bold" : "normal"
      }; font-size: 14px; white-space: nowrap;">${label}</div>
      <div style="font-size: 13px; white-space: nowrap;">${amount} ETH</div>
    `;

    container.appendChild(marker);
  }

  // Add Current marker (blue)
  addMarker(
    progressRatio,
    "#2196f3",
    "Current",
    currentAmount.toFixed(4),
    true
  );

  // Add milestone markers (orange)
  milestones.forEach((m) => {
    const pos = Math.min(m.value / goalAmount, 1);
    addMarker(pos, "#ff9800", m.label, m.value.toFixed(4));
  });

  // Add Target marker (green) at 100%
  addMarker(1, "#43a047", "Target", goalAmount.toFixed(4), true);

  // Add these variables
  const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
  const afterDeadline = now >= Number(campaign.deadline);
  const goalMet = campaign.pledged >= campaign.goal;
  const isCreator =
    currentUser.toLowerCase() === campaign.creator.toLowerCase();

  // Check if user is a donor
  const userContribution = await contract.contributions(
    campaignId,
    currentUser
  );
  const isDonor = userContribution > 0n;

  // Get button elements (add these IDs to your modal HTML)
  const donateBtn = document.getElementById("donate-btn");
  const withdrawBtn = document.getElementById("withdraw-btn");
  const refundBtn = document.getElementById("refund-btn");

  // Donate button logic
  if (!afterDeadline) {
    donateBtn.style.display = "block";
  } else {
    donateBtn.style.display = "none";
  }

  // Withdraw button (creator only + conditions)
  if (isCreator && afterDeadline && goalMet) {
    withdrawBtn.style.display = "block";
  } else {
    withdrawBtn.style.display = "none";
  }

  // Refund button (donors only + conditions)
  if (isDonor && afterDeadline && !goalMet) {
    refundBtn.style.display = "block";
  } else {
    refundBtn.style.display = "none";
  }

  // Add click handlers for withdraw/refund
  withdrawBtn.onclick = async () => {
    try {
      const tx = await contract.withdrawFunds(campaignId);
      await tx.wait();
      alert("Funds withdrawn successfully!");
      closeDetail();
    } catch (error) {
      console.error("Withdraw error:", error);
      alert("Withdrawal failed: " + error.message);
    }
  };

  refundBtn.onclick = async () => {
    try {
      const tx = await contract.refund(campaignId);
      await tx.wait();
      alert("Refund successful!");
      closeDetail();
    } catch (error) {
      console.error("Refund error:", error);
      alert("Refund failed: " + error.message);
    }
  };

  // Show modal
  document.getElementById("modal-backdrop").style.display = "block";

  // Setup donate button
  document.getElementById("donate-btn").onclick = async () => {
    const amount = document.getElementById("donate-amount").value;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      document.getElementById("donate-status").textContent =
        "Enter a valid amount.";
      return;
    }
    try {
      document.getElementById("donate-status").textContent = "Processing...";
      const tx = await contract.donate(campaignId, {
        value: ethers.parseEther(amount),
      });
      await tx.wait();
      document.getElementById("donate-status").textContent =
        "Donation successful!";
      await showCampaignDetail(campaignId); // Refresh details
    } catch (e) {
      document.getElementById("donate-status").textContent =
        "Donation failed: " + (e?.message || e);
    }
  };
}

export function closeDetail() {
  document.getElementById("modal-backdrop").style.display = "none";
}

// Optional: close modal when clicking outside the modal box
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-backdrop")) {
    closeDetail();
  }
});

// Make functions available for HTML event handlers if needed
window.showCampaignDetail = showCampaignDetail;
window.closeDetail = closeDetail;
window.loadCampaigns = loadCampaigns; // If you want to call from HTML or other scripts

