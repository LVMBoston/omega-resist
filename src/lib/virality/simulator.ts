import { supabase } from "@/integrations/supabase/client";

// US city coordinates lookup for zip code to lat/long conversion
export const SIMULATOR_CITIES: Record<string, { lat: number; lng: number; city: string; region: string; country: string }> = {
  // Major cities across US for simulation
  "19102": { lat: 39.9526, lng: -75.1652, city: "Philadelphia", region: "PA", country: "United States" },
  "10001": { lat: 40.7128, lng: -74.0060, city: "New York", region: "NY", country: "United States" },
  "90001": { lat: 34.0522, lng: -118.2437, city: "Los Angeles", region: "CA", country: "United States" },
  "60601": { lat: 41.8781, lng: -87.6298, city: "Chicago", region: "IL", country: "United States" },
  "77001": { lat: 29.7604, lng: -95.3698, city: "Houston", region: "TX", country: "United States" },
  "85001": { lat: 33.4484, lng: -112.0740, city: "Phoenix", region: "AZ", country: "United States" },
  "19019": { lat: 39.9526, lng: -75.1652, city: "Philadelphia", region: "PA", country: "United States" },
  "94102": { lat: 37.7749, lng: -122.4194, city: "San Francisco", region: "CA", country: "United States" },
  "98101": { lat: 47.6062, lng: -122.3321, city: "Seattle", region: "WA", country: "United States" },
  "02101": { lat: 42.3601, lng: -71.0589, city: "Boston", region: "MA", country: "United States" },
  "30301": { lat: 33.7490, lng: -84.3880, city: "Atlanta", region: "GA", country: "United States" },
  "33101": { lat: 25.7617, lng: -80.1918, city: "Miami", region: "FL", country: "United States" },
  // Campaign-specific zip codes
  "99501": { lat: 61.2181, lng: -149.9003, city: "Anchorage", region: "AK", country: "United States" },
  "02540": { lat: 41.5515, lng: -70.6148, city: "Falmouth", region: "MA", country: "United States" },
  "02601": { lat: 41.6521, lng: -70.2795, city: "Hyannis", region: "MA", country: "United States" },
  "02568": { lat: 41.3887, lng: -70.6083, city: "Vineyard Haven", region: "MA", country: "United States" },
  "02657": { lat: 42.0551, lng: -70.1710, city: "Provincetown", region: "MA", country: "United States" },
  "85085": { lat: 33.6820, lng: -112.1040, city: "Phoenix", region: "AZ", country: "United States" },
  "91360": { lat: 34.1964, lng: -118.8742, city: "Thousand Oaks", region: "CA", country: "United States" },
  
  // Extended zip code database for realistic share locations
  // Philadelphia area
  "19103": { lat: 39.9523, lng: -75.1638, city: "Philadelphia", region: "PA", country: "United States" },
  "19104": { lat: 39.9559, lng: -75.1967, city: "Philadelphia", region: "PA", country: "United States" },
  "19106": { lat: 39.9526, lng: -75.1481, city: "Philadelphia", region: "PA", country: "United States" },
  "19107": { lat: 39.9496, lng: -75.1603, city: "Philadelphia", region: "PA", country: "United States" },
  "19115": { lat: 40.0951, lng: -75.0421, city: "Philadelphia", region: "PA", country: "United States" },
  "19131": { lat: 39.9867, lng: -75.2207, city: "Philadelphia", region: "PA", country: "United States" },
  "19145": { lat: 39.9165, lng: -75.1819, city: "Philadelphia", region: "PA", country: "United States" },
  
  // New York area
  "10002": { lat: 40.7156, lng: -73.9860, city: "New York", region: "NY", country: "United States" },
  "10003": { lat: 40.7318, lng: -73.9889, city: "New York", region: "NY", country: "United States" },
  "10009": { lat: 40.7264, lng: -73.9776, city: "New York", region: "NY", country: "United States" },
  "10011": { lat: 40.7406, lng: -74.0006, city: "New York", region: "NY", country: "United States" },
  "10012": { lat: 40.7255, lng: -73.9983, city: "New York", region: "NY", country: "United States" },
  "10013": { lat: 40.7200, lng: -74.0054, city: "New York", region: "NY", country: "United States" },
  "10014": { lat: 40.7341, lng: -74.0067, city: "New York", region: "NY", country: "United States" },
  "11201": { lat: 40.6943, lng: -73.9903, city: "Brooklyn", region: "NY", country: "United States" },
  "11211": { lat: 40.7124, lng: -73.9534, city: "Brooklyn", region: "NY", country: "United States" },
  
  // Los Angeles area
  "90002": { lat: 33.9494, lng: -118.2471, city: "Los Angeles", region: "CA", country: "United States" },
  "90003": { lat: 33.9651, lng: -118.2726, city: "Los Angeles", region: "CA", country: "United States" },
  "90004": { lat: 34.0769, lng: -118.3089, city: "Los Angeles", region: "CA", country: "United States" },
  "90005": { lat: 34.0599, lng: -118.3014, city: "Los Angeles", region: "CA", country: "United States" },
  "90012": { lat: 34.0639, lng: -118.2378, city: "Los Angeles", region: "CA", country: "United States" },
  "90013": { lat: 34.0442, lng: -118.2476, city: "Los Angeles", region: "CA", country: "United States" },
  "90015": { lat: 34.0391, lng: -118.2651, city: "Los Angeles", region: "CA", country: "United States" },
  "90028": { lat: 34.1017, lng: -118.3290, city: "Los Angeles", region: "CA", country: "United States" },
  
  // Chicago area
  "60602": { lat: 41.8825, lng: -87.6291, city: "Chicago", region: "IL", country: "United States" },
  "60603": { lat: 41.8800, lng: -87.6289, city: "Chicago", region: "IL", country: "United States" },
  "60604": { lat: 41.8764, lng: -87.6295, city: "Chicago", region: "IL", country: "United States" },
  "60605": { lat: 41.8694, lng: -87.6192, city: "Chicago", region: "IL", country: "United States" },
  "60606": { lat: 41.8819, lng: -87.6392, city: "Chicago", region: "IL", country: "United States" },
  "60607": { lat: 41.8731, lng: -87.6532, city: "Chicago", region: "IL", country: "United States" },
  "60614": { lat: 41.9237, lng: -87.6531, city: "Chicago", region: "IL", country: "United States" },
  
  // Boston area
  "02108": { lat: 42.3584, lng: -71.0652, city: "Boston", region: "MA", country: "United States" },
  "02109": { lat: 42.3647, lng: -71.0542, city: "Boston", region: "MA", country: "United States" },
  "02110": { lat: 42.3584, lng: -71.0520, city: "Boston", region: "MA", country: "United States" },
  "02111": { lat: 42.3501, lng: -71.0620, city: "Boston", region: "MA", country: "United States" },
  "02113": { lat: 42.3667, lng: -71.0567, city: "Boston", region: "MA", country: "United States" },
  "02114": { lat: 42.3620, lng: -71.0686, city: "Boston", region: "MA", country: "United States" },
  "02115": { lat: 42.3428, lng: -71.0926, city: "Boston", region: "MA", country: "United States" },
  
  // Phoenix area
  "85003": { lat: 33.4484, lng: -112.0740, city: "Phoenix", region: "AZ", country: "United States" },
  "85004": { lat: 33.4549, lng: -112.0753, city: "Phoenix", region: "AZ", country: "United States" },
  "85006": { lat: 33.4605, lng: -112.0510, city: "Phoenix", region: "AZ", country: "United States" },
  "85007": { lat: 33.4501, lng: -112.0916, city: "Phoenix", region: "AZ", country: "United States" },
  "85008": { lat: 33.4751, lng: -112.0465, city: "Phoenix", region: "AZ", country: "United States" },
  "85012": { lat: 33.5025, lng: -112.0746, city: "Phoenix", region: "AZ", country: "United States" },
  "85013": { lat: 33.5001, lng: -112.0935, city: "Phoenix", region: "AZ", country: "United States" },
  
  // San Francisco area
  "94103": { lat: 37.7726, lng: -122.4099, city: "San Francisco", region: "CA", country: "United States" },
  "94104": { lat: 37.7910, lng: -122.4016, city: "San Francisco", region: "CA", country: "United States" },
  "94105": { lat: 37.7859, lng: -122.3892, city: "San Francisco", region: "CA", country: "United States" },
  "94107": { lat: 37.7625, lng: -122.3971, city: "San Francisco", region: "CA", country: "United States" },
  "94108": { lat: 37.7927, lng: -122.4073, city: "San Francisco", region: "CA", country: "United States" },
  "94109": { lat: 37.7908, lng: -122.4199, city: "San Francisco", region: "CA", country: "United States" },
  "94110": { lat: 37.7494, lng: -122.4156, city: "San Francisco", region: "CA", country: "United States" },
  
  // Seattle area
  "98102": { lat: 47.6295, lng: -122.3211, city: "Seattle", region: "WA", country: "United States" },
  "98103": { lat: 47.6691, lng: -122.3415, city: "Seattle", region: "WA", country: "United States" },
  "98104": { lat: 47.6038, lng: -122.3301, city: "Seattle", region: "WA", country: "United States" },
  "98105": { lat: 47.6629, lng: -122.3029, city: "Seattle", region: "WA", country: "United States" },
  "98106": { lat: 47.5324, lng: -122.3542, city: "Seattle", region: "WA", country: "United States" },
  "98107": { lat: 47.6686, lng: -122.3757, city: "Seattle", region: "WA", country: "United States" },
  "98109": { lat: 47.6336, lng: -122.3475, city: "Seattle", region: "WA", country: "United States" },
  
  // Atlanta area
  "30302": { lat: 33.7557, lng: -84.3902, city: "Atlanta", region: "GA", country: "United States" },
  "30303": { lat: 33.7490, lng: -84.3879, city: "Atlanta", region: "GA", country: "United States" },
  "30305": { lat: 33.8415, lng: -84.3850, city: "Atlanta", region: "GA", country: "United States" },
  "30306": { lat: 33.7909, lng: -84.3519, city: "Atlanta", region: "GA", country: "United States" },
  "30307": { lat: 33.7681, lng: -84.3408, city: "Atlanta", region: "GA", country: "United States" },
  "30308": { lat: 33.7712, lng: -84.3785, city: "Atlanta", region: "GA", country: "United States" },
  "30309": { lat: 33.7906, lng: -84.3831, city: "Atlanta", region: "GA", country: "United States" },
  
  // Miami area
  "33109": { lat: 25.7678, lng: -80.1347, city: "Miami Beach", region: "FL", country: "United States" },
  "33125": { lat: 25.7839, lng: -80.2357, city: "Miami", region: "FL", country: "United States" },
  "33126": { lat: 25.7781, lng: -80.2989, city: "Miami", region: "FL", country: "United States" },
  "33127": { lat: 25.8092, lng: -80.1944, city: "Miami", region: "FL", country: "United States" },
  "33128": { lat: 25.7656, lng: -80.1978, city: "Miami", region: "FL", country: "United States" },
  "33129": { lat: 25.7592, lng: -80.1914, city: "Miami", region: "FL", country: "United States" },
  "33130": { lat: 25.7514, lng: -80.2103, city: "Miami", region: "FL", country: "United States" },
  
  // Houston area
  "77002": { lat: 29.7589, lng: -95.3677, city: "Houston", region: "TX", country: "United States" },
  "77003": { lat: 29.7463, lng: -95.3540, city: "Houston", region: "TX", country: "United States" },
  "77004": { lat: 29.7294, lng: -95.3694, city: "Houston", region: "TX", country: "United States" },
  "77005": { lat: 29.7196, lng: -95.4294, city: "Houston", region: "TX", country: "United States" },
  "77006": { lat: 29.7408, lng: -95.3910, city: "Houston", region: "TX", country: "United States" },
  "77007": { lat: 29.7709, lng: -95.3949, city: "Houston", region: "TX", country: "United States" },
  "77008": { lat: 29.7971, lng: -95.4010, city: "Houston", region: "TX", country: "United States" },
  
  // Dallas area
  "75201": { lat: 32.7767, lng: -96.7970, city: "Dallas", region: "TX", country: "United States" },
  "75202": { lat: 32.7811, lng: -96.7951, city: "Dallas", region: "TX", country: "United States" },
  "75203": { lat: 32.7696, lng: -96.7698, city: "Dallas", region: "TX", country: "United States" },
  "75204": { lat: 32.8063, lng: -96.7854, city: "Dallas", region: "TX", country: "United States" },
  "75205": { lat: 32.8202, lng: -96.7943, city: "Dallas", region: "TX", country: "United States" },
  "75206": { lat: 32.8412, lng: -96.7730, city: "Dallas", region: "TX", country: "United States" },
  "75207": { lat: 32.7879, lng: -96.8154, city: "Dallas", region: "TX", country: "United States" },
  
  // Austin area
  "78701": { lat: 30.2713, lng: -97.7437, city: "Austin", region: "TX", country: "United States" },
  "78702": { lat: 30.2638, lng: -97.7196, city: "Austin", region: "TX", country: "United States" },
  "78703": { lat: 30.2857, lng: -97.7631, city: "Austin", region: "TX", country: "United States" },
  "78704": { lat: 30.2437, lng: -97.7645, city: "Austin", region: "TX", country: "United States" },
  "78705": { lat: 30.2897, lng: -97.7412, city: "Austin", region: "TX", country: "United States" },
  
  // San Antonio area
  "78201": { lat: 29.4498, lng: -98.4738, city: "San Antonio", region: "TX", country: "United States" },
  "78202": { lat: 29.4379, lng: -98.4621, city: "San Antonio", region: "TX", country: "United States" },
  "78203": { lat: 29.4023, lng: -98.4596, city: "San Antonio", region: "TX", country: "United States" },
  "78204": { lat: 29.4087, lng: -98.5115, city: "San Antonio", region: "TX", country: "United States" },
  "78205": { lat: 29.4252, lng: -98.4946, city: "San Antonio", region: "TX", country: "United States" },
  
  // Denver area
  "80201": { lat: 39.7515, lng: -104.9955, city: "Denver", region: "CO", country: "United States" },
  "80202": { lat: 39.7506, lng: -105.0007, city: "Denver", region: "CO", country: "United States" },
  "80203": { lat: 39.7307, lng: -104.9802, city: "Denver", region: "CO", country: "United States" },
  "80204": { lat: 39.7393, lng: -105.0075, city: "Denver", region: "CO", country: "United States" },
  "80205": { lat: 39.7586, lng: -104.9633, city: "Denver", region: "CO", country: "United States" },
  "80206": { lat: 39.7290, lng: -104.9537, city: "Denver", region: "CO", country: "United States" },
  "80207": { lat: 39.7724, lng: -104.9074, city: "Denver", region: "CO", country: "United States" },
  
  // Portland area
  "97201": { lat: 45.4990, lng: -122.6900, city: "Portland", region: "OR", country: "United States" },
  "97202": { lat: 45.4783, lng: -122.6360, city: "Portland", region: "OR", country: "United States" },
  "97203": { lat: 45.5935, lng: -122.7391, city: "Portland", region: "OR", country: "United States" },
  "97204": { lat: 45.5188, lng: -122.6766, city: "Portland", region: "OR", country: "United States" },
  "97205": { lat: 45.5223, lng: -122.6978, city: "Portland", region: "OR", country: "United States" },
  "97206": { lat: 45.4802, lng: -122.5967, city: "Portland", region: "OR", country: "United States" },
  "97209": { lat: 45.5310, lng: -122.6855, city: "Portland", region: "OR", country: "United States" },
  
  // Las Vegas area
  "89101": { lat: 36.1716, lng: -115.1391, city: "Las Vegas", region: "NV", country: "United States" },
  "89102": { lat: 36.1455, lng: -115.1639, city: "Las Vegas", region: "NV", country: "United States" },
  "89103": { lat: 36.1247, lng: -115.1745, city: "Las Vegas", region: "NV", country: "United States" },
  "89104": { lat: 36.1597, lng: -115.0926, city: "Las Vegas", region: "NV", country: "United States" },
  "89106": { lat: 36.1749, lng: -115.1727, city: "Las Vegas", region: "NV", country: "United States" },
  
  // Nashville area
  "37201": { lat: 36.1622, lng: -86.7742, city: "Nashville", region: "TN", country: "United States" },
  "37203": { lat: 36.1546, lng: -86.7909, city: "Nashville", region: "TN", country: "United States" },
  "37204": { lat: 36.1173, lng: -86.7681, city: "Nashville", region: "TN", country: "United States" },
  "37205": { lat: 36.1064, lng: -86.8450, city: "Nashville", region: "TN", country: "United States" },
  "37206": { lat: 36.1834, lng: -86.7356, city: "Nashville", region: "TN", country: "United States" },
  "37209": { lat: 36.1516, lng: -86.8289, city: "Nashville", region: "TN", country: "United States" },
  
  // Minneapolis area
  "55401": { lat: 44.9778, lng: -93.2650, city: "Minneapolis", region: "MN", country: "United States" },
  "55402": { lat: 44.9764, lng: -93.2729, city: "Minneapolis", region: "MN", country: "United States" },
  "55403": { lat: 44.9740, lng: -93.2594, city: "Minneapolis", region: "MN", country: "United States" },
  "55404": { lat: 44.9633, lng: -93.2572, city: "Minneapolis", region: "MN", country: "United States" },
  "55405": { lat: 44.9684, lng: -93.2813, city: "Minneapolis", region: "MN", country: "United States" },
  "55406": { lat: 44.9301, lng: -93.2226, city: "Minneapolis", region: "MN", country: "United States" },
  
  // St. Paul area
  "55101": { lat: 44.9441, lng: -93.0939, city: "St. Paul", region: "MN", country: "United States" },
  "55102": { lat: 44.9496, lng: -93.1002, city: "St. Paul", region: "MN", country: "United States" },
  "55103": { lat: 44.9605, lng: -93.1178, city: "St. Paul", region: "MN", country: "United States" },
  "55104": { lat: 44.9538, lng: -93.1587, city: "St. Paul", region: "MN", country: "United States" },
  "55105": { lat: 44.9363, lng: -93.1527, city: "St. Paul", region: "MN", country: "United States" },
  
  // Detroit area
  "48201": { lat: 42.3470, lng: -83.0691, city: "Detroit", region: "MI", country: "United States" },
  "48202": { lat: 42.3694, lng: -83.0782, city: "Detroit", region: "MI", country: "United States" },
  "48203": { lat: 42.3808, lng: -83.0615, city: "Detroit", region: "MI", country: "United States" },
  "48204": { lat: 42.3736, lng: -83.1285, city: "Detroit", region: "MI", country: "United States" },
  "48205": { lat: 42.4062, lng: -82.9988, city: "Detroit", region: "MI", country: "United States" },
  "48206": { lat: 42.3520, lng: -83.0872, city: "Detroit", region: "MI", country: "United States" },
  
  // Cleveland area
  "44101": { lat: 41.4818, lng: -81.6909, city: "Cleveland", region: "OH", country: "United States" },
  "44102": { lat: 41.4674, lng: -81.7458, city: "Cleveland", region: "OH", country: "United States" },
  "44103": { lat: 41.5061, lng: -81.6287, city: "Cleveland", region: "OH", country: "United States" },
  "44104": { lat: 41.4720, lng: -81.6144, city: "Cleveland", region: "OH", country: "United States" },
  "44105": { lat: 41.4531, lng: -81.6193, city: "Cleveland", region: "OH", country: "United States" },
  "44106": { lat: 41.5062, lng: -81.6032, city: "Cleveland", region: "OH", country: "United States" },
  
  // Columbus area
  "43201": { lat: 40.0087, lng: -83.0126, city: "Columbus", region: "OH", country: "United States" },
  "43202": { lat: 40.0179, lng: -83.0292, city: "Columbus", region: "OH", country: "United States" },
  "43203": { lat: 39.9494, lng: -82.9827, city: "Columbus", region: "OH", country: "United States" },
  "43204": { lat: 39.9590, lng: -83.0782, city: "Columbus", region: "OH", country: "United States" },
  "43205": { lat: 39.9668, lng: -82.9774, city: "Columbus", region: "OH", country: "United States" },
  "43206": { lat: 39.9375, lng: -82.9900, city: "Columbus", region: "OH", country: "United States" },
  
  // Pittsburgh area
  "15201": { lat: 40.4710, lng: -79.9548, city: "Pittsburgh", region: "PA", country: "United States" },
  "15202": { lat: 40.5170, lng: -80.0868, city: "Pittsburgh", region: "PA", country: "United States" },
  "15203": { lat: 40.4290, lng: -79.9795, city: "Pittsburgh", region: "PA", country: "United States" },
  "15204": { lat: 40.4584, lng: -80.0661, city: "Pittsburgh", region: "PA", country: "United States" },
  "15205": { lat: 40.4389, lng: -80.0774, city: "Pittsburgh", region: "PA", country: "United States" },
  "15206": { lat: 40.4664, lng: -79.9228, city: "Pittsburgh", region: "PA", country: "United States" },
  
  // Baltimore area
  "21201": { lat: 39.2904, lng: -76.6122, city: "Baltimore", region: "MD", country: "United States" },
  "21202": { lat: 39.2963, lng: -76.6048, city: "Baltimore", region: "MD", country: "United States" },
  "21205": { lat: 39.3007, lng: -76.5751, city: "Baltimore", region: "MD", country: "United States" },
  "21206": { lat: 39.3437, lng: -76.5368, city: "Baltimore", region: "MD", country: "United States" },
  "21209": { lat: 39.3721, lng: -76.6652, city: "Baltimore", region: "MD", country: "United States" },
  "21211": { lat: 39.3287, lng: -76.6278, city: "Baltimore", region: "MD", country: "United States" },
  
  // Washington DC area
  "20001": { lat: 38.9072, lng: -77.0130, city: "Washington", region: "DC", country: "United States" },
  "20002": { lat: 38.9004, lng: -76.9922, city: "Washington", region: "DC", country: "United States" },
  "20003": { lat: 38.8846, lng: -76.9944, city: "Washington", region: "DC", country: "United States" },
  "20004": { lat: 38.8996, lng: -77.0275, city: "Washington", region: "DC", country: "United States" },
  "20005": { lat: 38.9072, lng: -77.0369, city: "Washington", region: "DC", country: "United States" },
  "20006": { lat: 38.8996, lng: -77.0430, city: "Washington", region: "DC", country: "United States" },
  
  // Charlotte area
  "28202": { lat: 35.2271, lng: -80.8431, city: "Charlotte", region: "NC", country: "United States" },
  "28203": { lat: 35.2088, lng: -80.8553, city: "Charlotte", region: "NC", country: "United States" },
  "28204": { lat: 35.2181, lng: -80.8583, city: "Charlotte", region: "NC", country: "United States" },
  "28205": { lat: 35.2198, lng: -80.8061, city: "Charlotte", region: "NC", country: "United States" },
  "28206": { lat: 35.2561, lng: -80.8198, city: "Charlotte", region: "NC", country: "United States" },
  "28207": { lat: 35.1930, lng: -80.8309, city: "Charlotte", region: "NC", country: "United States" },
  
  // Raleigh area
  "27601": { lat: 35.7796, lng: -78.6382, city: "Raleigh", region: "NC", country: "United States" },
  "27602": { lat: 35.7625, lng: -78.6308, city: "Raleigh", region: "NC", country: "United States" },
  "27603": { lat: 35.7312, lng: -78.6223, city: "Raleigh", region: "NC", country: "United States" },
  "27604": { lat: 35.8235, lng: -78.5764, city: "Raleigh", region: "NC", country: "United States" },
  "27605": { lat: 35.8047, lng: -78.6564, city: "Raleigh", region: "NC", country: "United States" },
  "27606": { lat: 35.7432, lng: -78.7269, city: "Raleigh", region: "NC", country: "United States" },
  
  // Richmond area
  "23218": { lat: 37.5407, lng: -77.4360, city: "Richmond", region: "VA", country: "United States" },
  "23219": { lat: 37.5407, lng: -77.4430, city: "Richmond", region: "VA", country: "United States" },
  "23220": { lat: 37.5538, lng: -77.4595, city: "Richmond", region: "VA", country: "United States" },
  "23221": { lat: 37.5527, lng: -77.4847, city: "Richmond", region: "VA", country: "United States" },
  "23222": { lat: 37.5763, lng: -77.4325, city: "Richmond", region: "VA", country: "United States" },
  
  // Jacksonville area
  "32202": { lat: 30.3280, lng: -81.6557, city: "Jacksonville", region: "FL", country: "United States" },
  "32204": { lat: 30.3074, lng: -81.6979, city: "Jacksonville", region: "FL", country: "United States" },
  "32205": { lat: 30.2984, lng: -81.7151, city: "Jacksonville", region: "FL", country: "United States" },
  "32206": { lat: 30.3369, lng: -81.6285, city: "Jacksonville", region: "FL", country: "United States" },
  "32207": { lat: 30.3018, lng: -81.6364, city: "Jacksonville", region: "FL", country: "United States" },
  
  // Orlando area
  "32801": { lat: 28.5383, lng: -81.3792, city: "Orlando", region: "FL", country: "United States" },
  "32803": { lat: 28.5594, lng: -81.3682, city: "Orlando", region: "FL", country: "United States" },
  "32804": { lat: 28.5645, lng: -81.3936, city: "Orlando", region: "FL", country: "United States" },
  "32805": { lat: 28.5297, lng: -81.4144, city: "Orlando", region: "FL", country: "United States" },
  "32806": { lat: 28.5104, lng: -81.3674, city: "Orlando", region: "FL", country: "United States" },
  
  // Tampa area
  "33602": { lat: 27.9519, lng: -82.4587, city: "Tampa", region: "FL", country: "United States" },
  "33603": { lat: 28.0012, lng: -82.4490, city: "Tampa", region: "FL", country: "United States" },
  "33604": { lat: 27.9893, lng: -82.4232, city: "Tampa", region: "FL", country: "United States" },
  "33605": { lat: 27.9609, lng: -82.4339, city: "Tampa", region: "FL", country: "United States" },
  "33606": { lat: 27.9360, lng: -82.4745, city: "Tampa", region: "FL", country: "United States" },
  
  // New Orleans area
  "70112": { lat: 29.9511, lng: -90.0715, city: "New Orleans", region: "LA", country: "United States" },
  "70113": { lat: 29.9456, lng: -90.0808, city: "New Orleans", region: "LA", country: "United States" },
  "70115": { lat: 29.9241, lng: -90.0966, city: "New Orleans", region: "LA", country: "United States" },
  "70116": { lat: 29.9633, lng: -90.0610, city: "New Orleans", region: "LA", country: "United States" },
  "70117": { lat: 29.9718, lng: -90.0322, city: "New Orleans", region: "LA", country: "United States" },
  "70118": { lat: 29.9487, lng: -90.1138, city: "New Orleans", region: "LA", country: "United States" },
  
  // Memphis area
  "38103": { lat: 35.1432, lng: -90.0505, city: "Memphis", region: "TN", country: "United States" },
  "38104": { lat: 35.1334, lng: -90.0206, city: "Memphis", region: "TN", country: "United States" },
  "38105": { lat: 35.1562, lng: -90.0282, city: "Memphis", region: "TN", country: "United States" },
  "38106": { lat: 35.0890, lng: -90.0573, city: "Memphis", region: "TN", country: "United States" },
  "38107": { lat: 35.1636, lng: -90.0054, city: "Memphis", region: "TN", country: "United States" },
  
  // Louisville area
  "40202": { lat: 38.2542, lng: -85.7594, city: "Louisville", region: "KY", country: "United States" },
  "40203": { lat: 38.2398, lng: -85.7287, city: "Louisville", region: "KY", country: "United States" },
  "40204": { lat: 38.2274, lng: -85.7224, city: "Louisville", region: "KY", country: "United States" },
  "40205": { lat: 38.2196, lng: -85.6918, city: "Louisville", region: "KY", country: "United States" },
  "40206": { lat: 38.2506, lng: -85.6976, city: "Louisville", region: "KY", country: "United States" },
  
  // Indianapolis area
  "46201": { lat: 39.7685, lng: -86.1485, city: "Indianapolis", region: "IN", country: "United States" },
  "46202": { lat: 39.7817, lng: -86.1625, city: "Indianapolis", region: "IN", country: "United States" },
  "46203": { lat: 39.7335, lng: -86.1454, city: "Indianapolis", region: "IN", country: "United States" },
  "46204": { lat: 39.7683, lng: -86.1625, city: "Indianapolis", region: "IN", country: "United States" },
  "46205": { lat: 39.8205, lng: -86.1376, city: "Indianapolis", region: "IN", country: "United States" },
  
  // Milwaukee area
  "53202": { lat: 43.0389, lng: -87.9065, city: "Milwaukee", region: "WI", country: "United States" },
  "53203": { lat: 43.0431, lng: -87.9190, city: "Milwaukee", region: "WI", country: "United States" },
  "53204": { lat: 43.0085, lng: -87.9298, city: "Milwaukee", region: "WI", country: "United States" },
  "53205": { lat: 43.0658, lng: -87.9308, city: "Milwaukee", region: "WI", country: "United States" },
  "53206": { lat: 43.0780, lng: -87.9465, city: "Milwaukee", region: "WI", country: "United States" },
  
  // Kansas City area
  "64101": { lat: 39.1008, lng: -94.5833, city: "Kansas City", region: "MO", country: "United States" },
  "64102": { lat: 39.0997, lng: -94.5786, city: "Kansas City", region: "MO", country: "United States" },
  "64105": { lat: 39.0912, lng: -94.5770, city: "Kansas City", region: "MO", country: "United States" },
  "64106": { lat: 39.1072, lng: -94.5679, city: "Kansas City", region: "MO", country: "United States" },
  "64108": { lat: 39.0758, lng: -94.5763, city: "Kansas City", region: "MO", country: "United States" },
  
  // St. Louis area
  "63101": { lat: 38.6270, lng: -90.1994, city: "St. Louis", region: "MO", country: "United States" },
  "63102": { lat: 38.6333, lng: -90.1895, city: "St. Louis", region: "MO", country: "United States" },
  "63103": { lat: 38.6356, lng: -90.2053, city: "St. Louis", region: "MO", country: "United States" },
  "63104": { lat: 38.6078, lng: -90.2169, city: "St. Louis", region: "MO", country: "United States" },
  "63105": { lat: 38.6511, lng: -90.3351, city: "Clayton", region: "MO", country: "United States" },
  
  // Omaha area
  "68102": { lat: 41.2587, lng: -95.9378, city: "Omaha", region: "NE", country: "United States" },
  "68103": { lat: 41.2371, lng: -95.9466, city: "Omaha", region: "NE", country: "United States" },
  "68104": { lat: 41.2968, lng: -95.9765, city: "Omaha", region: "NE", country: "United States" },
  "68105": { lat: 41.2315, lng: -95.9813, city: "Omaha", region: "NE", country: "United States" },
  "68106": { lat: 41.2138, lng: -96.0134, city: "Omaha", region: "NE", country: "United States" },
  
  // Salt Lake City area
  "84101": { lat: 40.7608, lng: -111.8910, city: "Salt Lake City", region: "UT", country: "United States" },
  "84102": { lat: 40.7547, lng: -111.8653, city: "Salt Lake City", region: "UT", country: "United States" },
  "84103": { lat: 40.7820, lng: -111.8766, city: "Salt Lake City", region: "UT", country: "United States" },
  "84104": { lat: 40.7374, lng: -111.9499, city: "Salt Lake City", region: "UT", country: "United States" },
  "84105": { lat: 40.7363, lng: -111.8636, city: "Salt Lake City", region: "UT", country: "United States" },
  
  // Albuquerque area
  "87102": { lat: 35.0844, lng: -106.6504, city: "Albuquerque", region: "NM", country: "United States" },
  "87104": { lat: 35.1036, lng: -106.6770, city: "Albuquerque", region: "NM", country: "United States" },
  "87105": { lat: 35.0441, lng: -106.6824, city: "Albuquerque", region: "NM", country: "United States" },
  "87106": { lat: 35.0662, lng: -106.6153, city: "Albuquerque", region: "NM", country: "United States" },
  "87107": { lat: 35.1376, lng: -106.6297, city: "Albuquerque", region: "NM", country: "United States" },
  
  // Tucson area
  "85701": { lat: 32.2226, lng: -110.9747, city: "Tucson", region: "AZ", country: "United States" },
  "85702": { lat: 32.2540, lng: -110.9384, city: "Tucson", region: "AZ", country: "United States" },
  "85705": { lat: 32.2684, lng: -111.0090, city: "Tucson", region: "AZ", country: "United States" },
  "85706": { lat: 32.1538, lng: -110.9735, city: "Tucson", region: "AZ", country: "United States" },
  "85710": { lat: 32.2023, lng: -110.8762, city: "Tucson", region: "AZ", country: "United States" },
  
  // Sacramento area
  "95814": { lat: 38.5816, lng: -121.4944, city: "Sacramento", region: "CA", country: "United States" },
  "95815": { lat: 38.6047, lng: -121.4554, city: "Sacramento", region: "CA", country: "United States" },
  "95816": { lat: 38.5643, lng: -121.4768, city: "Sacramento", region: "CA", country: "United States" },
  "95817": { lat: 38.5509, lng: -121.4707, city: "Sacramento", region: "CA", country: "United States" },
  "95818": { lat: 38.5629, lng: -121.4884, city: "Sacramento", region: "CA", country: "United States" },
  
  // Fresno area
  "93701": { lat: 36.7378, lng: -119.7871, city: "Fresno", region: "CA", country: "United States" },
  "93702": { lat: 36.7932, lng: -119.8081, city: "Fresno", region: "CA", country: "United States" },
  "93703": { lat: 36.7824, lng: -119.7575, city: "Fresno", region: "CA", country: "United States" },
  "93704": { lat: 36.8237, lng: -119.7693, city: "Fresno", region: "CA", country: "United States" },
  "93705": { lat: 36.7748, lng: -119.8364, city: "Fresno", region: "CA", country: "United States" },
  
  // San Diego area
  "92101": { lat: 32.7157, lng: -117.1611, city: "San Diego", region: "CA", country: "United States" },
  "92102": { lat: 32.7040, lng: -117.1289, city: "San Diego", region: "CA", country: "United States" },
  "92103": { lat: 32.7523, lng: -117.1644, city: "San Diego", region: "CA", country: "United States" },
  "92104": { lat: 32.7420, lng: -117.1303, city: "San Diego", region: "CA", country: "United States" },
  "92105": { lat: 32.7331, lng: -117.0978, city: "San Diego", region: "CA", country: "United States" },
  
  // San Jose area
  "95110": { lat: 37.3382, lng: -121.8863, city: "San Jose", region: "CA", country: "United States" },
  "95112": { lat: 37.3541, lng: -121.8682, city: "San Jose", region: "CA", country: "United States" },
  "95113": { lat: 37.3338, lng: -121.8883, city: "San Jose", region: "CA", country: "United States" },
  "95116": { lat: 37.3519, lng: -121.8459, city: "San Jose", region: "CA", country: "United States" },
  "95117": { lat: 37.3103, lng: -121.9506, city: "San Jose", region: "CA", country: "United States" },
  
  // Boise area
  "83702": { lat: 43.6150, lng: -116.2023, city: "Boise", region: "ID", country: "United States" },
  "83703": { lat: 43.6065, lng: -116.2489, city: "Boise", region: "ID", country: "United States" },
  "83704": { lat: 43.6532, lng: -116.2936, city: "Boise", region: "ID", country: "United States" },
  "83705": { lat: 43.5979, lng: -116.1638, city: "Boise", region: "ID", country: "United States" },
  "83706": { lat: 43.5737, lng: -116.2362, city: "Boise", region: "ID", country: "United States" },
  
  // Spokane area
  "99201": { lat: 47.6588, lng: -117.4260, city: "Spokane", region: "WA", country: "United States" },
  "99202": { lat: 47.6451, lng: -117.3915, city: "Spokane", region: "WA", country: "United States" },
  "99203": { lat: 47.6370, lng: -117.4097, city: "Spokane", region: "WA", country: "United States" },
  "99204": { lat: 47.6525, lng: -117.4437, city: "Spokane", region: "WA", country: "United States" },
  "99205": { lat: 47.6923, lng: -117.4281, city: "Spokane", region: "WA", country: "United States" },
};

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  country_code: string;
  zip_code: string;
}

/**
 * Get base location for L00 from EOA zip code
 */
export function getL00Location(zipCode: string, city?: string, state?: string): LocationData | null {
  const cityData = SIMULATOR_CITIES[zipCode];
  
  if (!cityData) {
    // If zip not in lookup, return null
    return null;
  }
  
  return {
    latitude: cityData.lat,
    longitude: cityData.lng,
    city: city || cityData.city,
    region: state || cityData.region,
    country: cityData.country,
    country_code: "US",
    zip_code: zipCode,
  };
}

/**
 * Calculate distance between two coordinates in degrees
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

/**
 * Find all zip codes within a certain radius of a location
 */
function findNearbyZipCodes(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): Array<{ zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } }> {
  const nearby: Array<{ zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } }> = [];
  
  for (const [zipCode, data] of Object.entries(SIMULATOR_CITIES)) {
    const distance = calculateDistance(baseLat, baseLng, data.lat, data.lng);
    if (distance <= maxDistanceDegrees) {
      nearby.push({ zipCode, data });
    }
  }
  
  return nearby;
}

/**
 * Select a random nearby location from real zip codes
 */
function selectRandomNearbyLocation(
  baseLat: number,
  baseLng: number,
  maxDistanceDegrees: number
): { zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } } | null {
  const nearby = findNearbyZipCodes(baseLat, baseLng, maxDistanceDegrees);
  
  if (nearby.length === 0) {
    // If no nearby zip codes found, return a random zip code from the database
    const allZipCodes = Object.entries(SIMULATOR_CITIES);
    const randomIndex = Math.floor(Math.random() * allZipCodes.length);
    return {
      zipCode: allZipCodes[randomIndex][0],
      data: allZipCodes[randomIndex][1]
    };
  }
  
  // Select random zip code from nearby options
  const randomIndex = Math.floor(Math.random() * nearby.length);
  return nearby[randomIndex];
}

/**
 * Get a completely random US location (for viral jumps)
 */
function getRandomUSLocation(): { zipCode: string; data: { lat: number; lng: number; city: string; region: string; country: string } } {
  const allZipCodes = Object.entries(SIMULATOR_CITIES);
  const randomIndex = Math.floor(Math.random() * allZipCodes.length);
  return {
    zipCode: allZipCodes[randomIndex][0],
    data: allZipCodes[randomIndex][1]
  };
}

/**
 * Generate L01 location - 70% local (within 10 miles), 30% anywhere in US
 */
export function getL01Location(parentLocation: LocationData): LocationData {
  const isViralJump = Math.random() < 0.30; // 30% chance of viral jump
  
  let selectedLocation;
  if (isViralJump) {
    // Viral jump to anywhere in US
    selectedLocation = getRandomUSLocation();
  } else {
    // Local share within ~10 miles
    selectedLocation = selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      0.15 // ±0.15° ≈ ±10 miles
    );
  }
  
  if (!selectedLocation) {
    return parentLocation;
  }
  
  return {
    latitude: selectedLocation.data.lat,
    longitude: selectedLocation.data.lng,
    city: selectedLocation.data.city,
    region: selectedLocation.data.region,
    country: selectedLocation.data.country,
    country_code: "US",
    zip_code: selectedLocation.zipCode,
  };
}

/**
 * Generate L02 location - 50% regional (within 50 miles), 50% anywhere in US
 */
export function getL02Location(parentLocation: LocationData): LocationData {
  const isViralJump = Math.random() < 0.50; // 50% chance of viral jump
  
  let selectedLocation;
  if (isViralJump) {
    // Viral jump to anywhere in US
    selectedLocation = getRandomUSLocation();
  } else {
    // Regional share within ~50 miles
    selectedLocation = selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      0.75 // ±0.75° ≈ ±50 miles
    );
  }
  
  if (!selectedLocation) {
    return parentLocation;
  }
  
  return {
    latitude: selectedLocation.data.lat,
    longitude: selectedLocation.data.lng,
    city: selectedLocation.data.city,
    region: selectedLocation.data.region,
    country: selectedLocation.data.country,
    country_code: "US",
    zip_code: selectedLocation.zipCode,
  };
}

/**
 * Generate L03 location - 20% regional (within 100 miles), 80% anywhere in US
 */
export function getL03Location(parentLocation: LocationData): LocationData {
  const isViralJump = Math.random() < 0.80; // 80% chance of viral jump
  
  let selectedLocation;
  if (isViralJump) {
    // Viral jump to anywhere in US
    selectedLocation = getRandomUSLocation();
  } else {
    // Regional share within ~100 miles
    selectedLocation = selectRandomNearbyLocation(
      parentLocation.latitude,
      parentLocation.longitude,
      1.5 // ±1.5° ≈ ±100 miles
    );
  }
  
  if (!selectedLocation) {
    return parentLocation;
  }
  
  return {
    latitude: selectedLocation.data.lat,
    longitude: selectedLocation.data.lng,
    city: selectedLocation.data.city,
    region: selectedLocation.data.region,
    country: selectedLocation.data.country,
    country_code: "US",
    zip_code: selectedLocation.zipCode,
  };
}

/**
 * Get location for any level token based on parent
 */
export function getLocationForLevel(
  level: number,
  parentLocation: LocationData
): LocationData {
  switch (level) {
    case 1:
      return getL01Location(parentLocation);
    case 2:
      return getL02Location(parentLocation);
    case 3:
      return getL03Location(parentLocation);
    default:
      return parentLocation;
  }
}

/**
 * Generate random timestamp within date range
 */
export function randomTimestampInRange(startDate: Date, endDate: Date): Date {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return new Date(start + Math.random() * (end - start));
}

/**
 * Log event with location data using supabase RPC
 */
export async function logEventWithLocation(
  token: string,
  eventType: "scan" | "view" | "share",
  location: LocationData
) {
  // Insert directly with is_simulated flag
  const { data, error } = await supabase
    .from("url_events")
    .insert({
      token,
      event_type: eventType,
      latitude: location.latitude,
      longitude: location.longitude,
      city: location.city,
      region: location.region,
      country: location.country,
      country_code: location.country_code,
      zip_code: location.zip_code,
      is_simulated: true,
      user_agent: "Simulator/1.0",
      occurred_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error logging simulated event:", error);
    throw error;
  }

  return data;
}
