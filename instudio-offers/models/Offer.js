// models/Offer.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  offers_id: { type: String, required: true },
  salon_id: { type: String, required: true },
  title: { type: String, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  condition: { type: String, required: true },
  description: { type: String, required: true },
  discount: { type: Number, required: true },
  image_url: { type: String, required: true },
  is_active: { type: Boolean, default: true },
});

module.exports = mongoose.model('Offer', offerSchema);
