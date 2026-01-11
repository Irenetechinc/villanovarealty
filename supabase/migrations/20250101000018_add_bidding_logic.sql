-- Function to automatically update auction current_bid when a new bid is placed
CREATE OR REPLACE FUNCTION handle_new_bid()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auction's current_bid
  -- We rely on the application/RLS to ensure the bid is valid (higher than previous)
  -- But we can enforce it here too or just update blindly assuming order
  
  UPDATE auctions
  SET current_bid = NEW.amount,
      updated_at = NOW()
  WHERE id = NEW.auction_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function
DROP TRIGGER IF EXISTS on_new_bid ON bids;
CREATE TRIGGER on_new_bid
AFTER INSERT ON bids
FOR EACH ROW
EXECUTE FUNCTION handle_new_bid();
