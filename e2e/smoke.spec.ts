import { test,expect } from '@playwright/test';
test('simulator updates and model reference is available',async({page})=>{
  await page.goto('/');await expect(page.getByText('Simulation results')).toBeVisible();await expect(page.getByText('Orbital period')).toBeVisible();
  const before=await page.locator('.kpi').filter({hasText:'Orbital period'}).locator('.kpi-value').innerText();
  await page.getByLabel('Worst case').uncheck();await page.getByRole('button',{name:'O3b'}).click();
  await expect.poll(async()=>page.locator('.kpi').filter({hasText:'Orbital period'}).locator('.kpi-value').innerText()).not.toBe(before);
  await page.getByRole('button',{name:/Select outputs/}).click();await page.getByLabel('Magnetic field', {exact:true}).check();await expect(page.getByRole('heading',{name:'Magnetic field'})).toBeVisible();
  await page.getByRole('link',{name:'Model & assumptions'}).click();await expect(page.getByRole('heading',{name:'Model & assumptions'})).toBeVisible();await expect(page.locator('.function-card')).toHaveCount(15);
});
test('sizing, heatmap and Monte Carlo analyses complete',async({page})=>{
  await page.goto('/');await expect(page.getByText('Simulation results')).toBeVisible();
  await page.getByRole('button',{name:/Select outputs/}).click();
  await page.getByLabel('Sizing loop').check();await page.getByLabel('Heatmap').check();await page.getByLabel('Monte Carlo').check();
  await page.getByRole('button',{name:/Select outputs/}).click();
  for(const name of ['Worst-case sizing','Parameter heatmap','Monte Carlo uncertainty']){
    const card=page.locator('.analysis-card').filter({has:page.getByRole('heading',{name})});
    await card.getByRole('button',{name:'Run analysis'}).click();
    await expect(card.getByRole('button',{name:'Rerun analysis'})).toBeVisible({timeout:30000});
  }
  await expect(page.getByText('Minimum array')).toBeVisible();
  await expect(page.getByText('P95 DoD')).toBeVisible();
});
test('header tabs and dark mode work across both pages',async({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle('Simplified MEO Power Model | Parametric simulator demo');
  await expect(page.getByRole('link',{name:'Simulator'})).toHaveAttribute('aria-current','page');
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('link',{name:'Model & assumptions'}).click();
  await expect(page.getByRole('link',{name:'Model & assumptions'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button',{name:'Switch to light mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('simulator panels resize by dragging and keyboard, then retain their widths',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');
  await expect(page.getByText('Simulation results')).toBeVisible();
  const inputDivider=page.getByRole('separator',{name:'Resize parameter input and simulation results'});
  const viewDivider=page.getByRole('separator',{name:'Resize simulation results and visualisation'});
  const originalInput=Number(await inputDivider.getAttribute('aria-valuenow'));
  const handle=await inputDivider.boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);
  await page.mouse.down();
  await page.mouse.move(handle!.x+handle!.width/2+80,handle!.y+handle!.height/2,{steps:5});
  await page.mouse.up();
  await expect.poll(async()=>Number(await inputDivider.getAttribute('aria-valuenow'))).toBeGreaterThan(originalInput+50);
  const originalView=Number(await viewDivider.getAttribute('aria-valuenow'));
  await viewDivider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async()=>Number(await viewDivider.getAttribute('aria-valuenow'))).toBe(originalView+16);
  const resizedInput=await inputDivider.getAttribute('aria-valuenow');
  const resizedView=await viewDivider.getAttribute('aria-valuenow');
  await page.reload();
  await expect(inputDivider).toHaveAttribute('aria-valuenow',resizedInput!);
  await expect(viewDivider).toHaveAttribute('aria-valuenow',resizedView!);
  await page.setViewportSize({width:1100,height:800});
  const results=await page.locator('#results-panel').boundingBox();
  const card=await page.locator('.output-card').first().boundingBox();
  expect(card!.x+card!.width).toBeLessThanOrEqual(results!.x+results!.width+1);
});
