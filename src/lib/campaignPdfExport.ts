import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface CampaignRecapData {
  campaign: {
    title: string;
    code: string;
    description: string | null;
    created_at: string;
  };
  events: Array<{
    title: string;
    type: string;
    city: string | null;
    state: string | null;
    start_date: string | null;
  }>;
  tokensByLevel: Record<number, { count: number; uniqueParents: number }>;
  totalTokens: number;
  engagement: {
    views: number;
    scans: number;
    shares: number;
  };
  maxLevel: number;
}

export async function fetchCampaignRecapData(campaignCode: string): Promise<CampaignRecapData> {
  // Fetch campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('code', campaignCode)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignCode}`);
  }

  // Fetch events
  const { data: events } = await supabase
    .from('events_actions')
    .select('title, type, city, state, start_date')
    .eq('campaign_id', campaign.id);

  // Fetch tokens with level distribution
  const { data: tokens } = await supabase
    .from('tokens')
    .select('token, level, parent_token')
    .eq('is_simulated', false)
    .in('eoa_id', 
      (await supabase
        .from('events_actions')
        .select('id')
        .eq('campaign_id', campaign.id)
      ).data?.map(e => e.id) || []
    );

  // Calculate token distribution by level
  const tokensByLevel: Record<number, { count: number; uniqueParents: Set<string> }> = {};
  let maxLevel = 0;

  (tokens || []).forEach(t => {
    if (!tokensByLevel[t.level]) {
      tokensByLevel[t.level] = { count: 0, uniqueParents: new Set() };
    }
    tokensByLevel[t.level].count++;
    if (t.parent_token) {
      tokensByLevel[t.level].uniqueParents.add(t.parent_token);
    }
    maxLevel = Math.max(maxLevel, t.level);
  });

  // Convert Sets to counts
  const tokensByLevelFinal: Record<number, { count: number; uniqueParents: number }> = {};
  Object.entries(tokensByLevel).forEach(([level, data]) => {
    tokensByLevelFinal[Number(level)] = {
      count: data.count,
      uniqueParents: data.uniqueParents.size || (Number(level) === 0 ? 1 : 0)
    };
  });

  // Fetch engagement data
  const tokenIds = (tokens || []).map(t => t.token);
  const { data: urlEvents } = await supabase
    .from('url_events')
    .select('event_type')
    .in('token', tokenIds)
    .eq('is_simulated', false);

  const engagement = {
    views: (urlEvents || []).filter(e => e.event_type === 'view').length,
    scans: (urlEvents || []).filter(e => e.event_type === 'scan').length,
    shares: (urlEvents || []).filter(e => e.event_type === 'share').length,
  };

  return {
    campaign: {
      title: campaign.title,
      code: campaign.code,
      description: campaign.description,
      created_at: campaign.created_at,
    },
    events: events || [],
    tokensByLevel: tokensByLevelFinal,
    totalTokens: tokens?.length || 0,
    engagement,
    maxLevel,
  };
}

export function generateCampaignRecapPdf(data: CampaignRecapData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(`Campaign Recap: ${data.campaign.code}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Subtitle
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(data.campaign.title, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Description
  if (data.campaign.description) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    const descLines = doc.splitTextToSize(data.campaign.description, pageWidth - 40);
    doc.text(descLines, pageWidth / 2, y, { align: 'center' });
    y += descLines.length * 5 + 5;
  }

  // Created date
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Created: ${new Date(data.campaign.created_at).toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Divider
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Events Section
  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Events/Actions', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (data.events.length === 0) {
    doc.text('No events found', 20, y);
    y += 6;
  } else {
    data.events.forEach(event => {
      const location = [event.city, event.state].filter(Boolean).join(', ');
      const date = event.start_date ? new Date(event.start_date).toLocaleDateString() : 'No date';
      doc.text(`• ${event.title} (${event.type})`, 25, y);
      y += 5;
      doc.setTextColor(80);
      doc.text(`  ${location || 'No location'} | ${date}`, 25, y);
      doc.setTextColor(0);
      y += 7;
    });
  }
  y += 5;

  // Token Distribution Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Token Distribution', 20, y);
  y += 10;

  // Table header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  doc.text('Level', 25, y);
  doc.text('Token Count', 80, y);
  doc.text('Unique Parents', 130, y);
  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  const levels = Object.keys(data.tokensByLevel).map(Number).sort((a, b) => a - b);
  
  levels.forEach((level, idx) => {
    const levelData = data.tokensByLevel[level];
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }
    doc.text(`L${level}`, 25, y);
    doc.text(String(levelData.count), 80, y);
    doc.text(String(levelData.uniqueParents), 130, y);
    y += 7;
  });

  // Total row
  const totalParents = levels.reduce((sum, level) => sum + (data.tokensByLevel[level]?.uniqueParents || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(230, 230, 230);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  doc.text('Total', 25, y);
  doc.text(String(data.totalTokens), 80, y);
  doc.text(String(totalParents), 130, y);
  y += 15;

  // Key Metrics Summary - Tokens vs Events distinction
  doc.setFontSize(16);
  doc.text('Key Metrics', 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Two-column layout for Tokens vs Events
  const halfWidth = (pageWidth - 50) / 2;
  
  // Tokens Minted Box
  doc.setFillColor(230, 245, 255);
  doc.roundedRect(20, y, halfWidth, 35, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tokens Minted', 20 + halfWidth / 2, y + 8, { align: 'center' });
  doc.setFontSize(24);
  doc.text(String(data.totalTokens), 20 + halfWidth / 2, y + 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('Unique share links created', 20 + halfWidth / 2, y + 30, { align: 'center' });
  doc.setTextColor(0);
  
  // Events Recorded Box
  const totalEvents = data.engagement.views + data.engagement.scans + data.engagement.shares;
  doc.setFillColor(255, 240, 230);
  doc.roundedRect(30 + halfWidth, y, halfWidth, 35, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Events Recorded', 30 + halfWidth + halfWidth / 2, y + 8, { align: 'center' });
  doc.setFontSize(24);
  doc.text(String(totalEvents), 30 + halfWidth + halfWidth / 2, y + 22, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('Actual interactions logged', 30 + halfWidth + halfWidth / 2, y + 30, { align: 'center' });
  doc.setTextColor(0);
  
  y += 42;

  // Event Type Breakdown
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Event Breakdown', 20, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const eventMetrics = [
    { label: 'Views', value: data.engagement.views },
    { label: 'Scans', value: data.engagement.scans },
    { label: 'Shares', value: data.engagement.shares },
  ];

  const boxWidth = (pageWidth - 60) / 3;
  eventMetrics.forEach((metric, idx) => {
    const x = 20 + idx * (boxWidth + 10);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x, y, boxWidth, 25, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(String(metric.value), x + boxWidth / 2, y + 12, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(metric.label, x + boxWidth / 2, y + 20, { align: 'center' });
    doc.setTextColor(0);
  });
  y += 35;

  // Viral Spread Summary
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Viral Spread Summary', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Maximum propagation depth: ${data.maxLevel} levels`, 25, y);
  y += 6;
  
  const mostActiveLevel = levels.reduce((max, level) => 
    (data.tokensByLevel[level]?.count || 0) > (data.tokensByLevel[max]?.count || 0) ? level : max
  , levels[0] || 0);
  doc.text(`• Most active level: L${mostActiveLevel} with ${data.tokensByLevel[mostActiveLevel]?.count || 0} tokens`, 25, y);
  y += 6;

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY, { align: 'center' });

  return doc;
}

export async function downloadCampaignRecapPdf(campaignCode: string): Promise<void> {
  const data = await fetchCampaignRecapData(campaignCode);
  const doc = generateCampaignRecapPdf(data);
  doc.save(`${campaignCode}-recap.pdf`);
}
