-- Add QR code default settings
INSERT INTO settings (category, key, value, description) VALUES
('qr_defaults', 'size_preset', '{"selected": "medium"}', 'QR code size preset: small (255px), medium (512px), or large (1000px)'),
('qr_defaults', 'top_caption', '{"text": ""}', 'Default text to display above QR code'),
('qr_defaults', 'bottom_caption', '{"text": "{eoa_title}"}', 'Default text to display below QR code (use {eoa_title} as placeholder)'),
('qr_defaults', 'border_width', '{"value": 20}', 'QR code border width in pixels'),
('qr_defaults', 'border_color', '{"value": "#000000"}', 'QR code border color (hex)'),
('qr_defaults', 'background_color', '{"value": "#FFFFFF"}', 'QR code background color (hex)'),
('qr_defaults', 'text_color', '{"value": "#000000"}', 'QR code text color (hex)'),
('qr_defaults', 'padding', '{"value": 100}', 'Padding around QR code in pixels'),
('qr_defaults', 'logo_size_percent', '{"value": 20}', 'Logo size as percentage of QR code size')
ON CONFLICT (category, key) DO NOTHING;