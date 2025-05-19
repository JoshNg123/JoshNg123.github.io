// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract CrowdFund {
    struct Campaign {
        address creator;
        string title;         // Campaign title
        string description;   // General campaign description
        uint goal;            // Total goal amount (in wei)
        uint pledged;         // Total pledged so far (in wei)
        uint32 deadline;      // Timestamp when campaign ends
        bool closed;          // True if funds withdrawn or refunded
    }

    struct Milestone {
        string description;   // Milestone-specific description
        uint targetAmount;    // Target amount for this milestone (in wei)
    }

    struct Donation {
        address donor;
        uint amount;
        uint timestamp;
    }

    // Storage
    mapping(uint => Campaign) public campaigns;
    mapping(uint => Milestone[]) public milestones;           // campaignId → milestones
    mapping(uint => mapping(address => uint)) public contributions; // campaignId → donor → amount
    mapping(uint => Donation[]) public donationHistory;       // campaignId → donation records
    uint public campaignCount;

    // Events
    event CampaignCreated(uint campaignId, address creator);
    event DonationReceived(uint campaignId, address donor, uint amount);
    event FundsWithdrawn(uint campaignId, address creator, uint amount);
    event RefundIssued(uint campaignId, address donor, uint amount);

    // Create campaign and all milestones at once
    function createCampaign(
        string memory _title,
        string memory _description,
        uint _goal,
        uint32 _duration,
        string[] memory _milestoneDescriptions,
        uint[] memory _milestoneTargets
    ) external {
        require(_milestoneDescriptions.length == _milestoneTargets.length, "Milestone data mismatch");

        campaignCount++;
        campaigns[campaignCount] = Campaign({
            creator: msg.sender,
            title: _title,
            description: _description,
            goal: _goal,
            pledged: 0,
            deadline: uint32(block.timestamp + _duration),
            closed: false
        });

        for (uint i = 0; i < _milestoneDescriptions.length; i++) {
            milestones[campaignCount].push(Milestone(_milestoneDescriptions[i], _milestoneTargets[i]));
        }

        emit CampaignCreated(campaignCount, msg.sender);
    }

    // Donate to campaign (records donor/timestamp)
    function donate(uint _campaignId) external payable {
        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.closed, "Campaign closed");
        require(block.timestamp < campaign.deadline, "Campaign ended");
        require(msg.value > 0, "No ETH sent");
        
        campaign.pledged += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;
        donationHistory[_campaignId].push(Donation(msg.sender, msg.value, block.timestamp));
        
        emit DonationReceived(_campaignId, msg.sender, msg.value);
    }

    // Withdraw funds (creator only)
    function withdrawFunds(uint _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Not creator");
        require(block.timestamp >= campaign.deadline, "Campaign ongoing");
        require(!campaign.closed, "Already withdrawn/refunded");
        require(campaign.pledged >= campaign.goal, "Goal not met");

        campaign.closed = true;
        uint amount = campaign.pledged;
        payable(campaign.creator).transfer(amount);
        emit FundsWithdrawn(_campaignId, msg.sender, amount);
    }

    // Refund donors (if goal not met)
    function refund(uint _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline, "Campaign ongoing");
        require(!campaign.closed, "Already withdrawn/refunded");
        require(campaign.pledged < campaign.goal, "Goal met");

        uint amount = contributions[_campaignId][msg.sender];
        require(amount > 0, "No contribution");
        contributions[_campaignId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit RefundIssued(_campaignId, msg.sender, amount);
    }

    // Frontend helper functions
    function getMilestoneCount(uint _campaignId) external view returns (uint) {
        return milestones[_campaignId].length;
    }

    function getMilestone(uint _campaignId, uint _index) external view returns (string memory, uint) {
        Milestone storage m = milestones[_campaignId][_index];
        return (m.description, m.targetAmount);
    }

    function getDonationCount(uint _campaignId) external view returns (uint) {
        return donationHistory[_campaignId].length;
    }

    function getDonation(uint _campaignId, uint _index) external view returns (
        address donor,
        uint amount,
        uint timestamp
    ) {
        Donation storage d = donationHistory[_campaignId][_index];
        return (d.donor, d.amount, d.timestamp);
    }
}
