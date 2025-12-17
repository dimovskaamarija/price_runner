# Cron Job Troubleshooting Guide

## Issue: Scraper Cron Jobs Not Executing in Production

Your scraper cron job is configured with `@Cron('0 16 * * *')` which should run at 4 PM UTC daily. Here are the most common reasons why it might not be working in production:

---

## 🔍 Common Causes & Solutions

### 1. **Timezone Issues** ⏰

**Problem**: Cron expressions use UTC by default. `'0 16 * * *'` means 4 PM UTC, which might not be your local time.

**Solution**: Explicitly set timezone in your cron configuration:

```typescript
// backend/src/modules/scraper/services/scraper.service.ts
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ScraperService {
    // Option 1: Use timezone parameter
    @Cron('0 16 * * *', {
        timezone: 'Europe/Skopje', // Or your timezone
    })
    async runAll() {
        // ... your code
    }

    // Option 2: Use CronExpression with timezone
    @Cron(CronExpression.EVERY_DAY_AT_4PM, {
        timezone: 'Europe/Skopje',
    })
    async runAll() {
        // ... your code
    }
}
```

**Check your timezone**: 
- UTC: `'0 16 * * *'` = 4 PM UTC
- Europe/Skopje (UTC+1): `'0 15 * * *'` = 4 PM local time
- Europe/Skopje (UTC+2 in summer): `'0 14 * * *'` = 4 PM local time

---

### 2. **Application Not Running Continuously** 🚫

**Problem**: On free tiers (like Render), apps sleep after 15 minutes of inactivity. Cron jobs won't run if the app is sleeping.

**Solutions**:
- **Upgrade to paid tier** (keeps app always running)
- **Use external cron service** (see below)
- **Use platform-specific schedulers** (Railway Cron, Render Cron Jobs)

---

### 3. **Multiple Instances / Load Balancing** ⚖️

**Problem**: If you have multiple instances running, cron jobs might:
- Run multiple times (once per instance)
- Not run at all (if load balancer doesn't route to the right instance)

**Solution**: Use a distributed lock or run cron on a single instance:

```typescript
// Add environment variable to control cron execution
@Cron('0 16 * * *', {
    timezone: 'Europe/Skopje',
})
async runAll() {
    // Only run on primary instance
    if (process.env.ENABLE_CRON !== 'true') {
        this.log.log('Cron disabled on this instance');
        return;
    }
    // ... rest of code
}
```

Then set `ENABLE_CRON=true` only on one instance.

---

### 4. **ScheduleModule Not Properly Initialized** 🔧

**Problem**: ScheduleModule might not be initialized correctly.

**Check**: Verify `ScheduleModule.forRoot()` is in `app.module.ts`:

```typescript
// backend/src/app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        ScheduleModule.forRoot(), // ✅ Must be present
        // ... other modules
    ],
})
export class AppModule {}
```

---

### 5. **Silent Failures** 🔇

**Problem**: Cron jobs might be failing silently without logging.

**Solution**: Add comprehensive error handling and logging:

```typescript
@Cron('0 16 * * *', {
    timezone: 'Europe/Skopje',
})
async runAll() {
    try {
        this.log.log('=== CRON JOB STARTED ===');
        this.log.log(`Time: ${new Date().toISOString()}`);
        this.log.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        
        // ... your scraping code
        
        this.log.log('=== CRON JOB COMPLETED SUCCESSFULLY ===');
    } catch (error) {
        this.log.error('=== CRON JOB FAILED ===');
        this.log.error(error);
        // Optionally send alert/notification
    }
}
```

---

### 6. **Production Environment Detection** 🏭

**Problem**: Cron might be disabled in production by mistake.

**Solution**: Add environment-based control:

```typescript
@Cron('0 16 * * *', {
    timezone: 'Europe/Skopje',
})
async runAll() {
    // Skip if not in production (or enable only in production)
    if (process.env.NODE_ENV !== 'production') {
        this.log.log('Cron skipped - not in production');
        return;
    }
    
    // Or use a dedicated env variable
    if (process.env.ENABLE_SCRAPER_CRON !== 'true') {
        this.log.log('Cron disabled via ENABLE_SCRAPER_CRON env var');
        return;
    }
    
    // ... rest of code
}
```

---

## 🛠️ Recommended Fixes

### Fix 1: Update Scraper Service with Timezone & Error Handling

```typescript
// backend/src/modules/scraper/services/scraper.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
// ... other imports

@Injectable()
export class ScraperService {
    private readonly log = new Logger(ScraperService.name);

    constructor(
        // ... your dependencies
    ) {}

    @Cron('0 16 * * *', {
        timezone: 'Europe/Skopje', // Adjust to your timezone
    })
    async runAll() {
        const startTime = new Date();
        this.log.log('=== SCRAPER CRON JOB STARTED ===');
        this.log.log(`Start Time: ${startTime.toISOString()}`);
        this.log.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        this.log.log(`NODE_ENV: ${process.env.NODE_ENV}`);
        
        try {
            // Check if cron is enabled
            if (process.env.ENABLE_SCRAPER_CRON === 'false') {
                this.log.log('Cron disabled via ENABLE_SCRAPER_CRON=false');
                return;
            }

            // Your existing scraping code
            this.log.log('Starting SportVision scrape…');
            await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/obuvki', 'Обувки');
            // ... rest of your scraping code

            const endTime = new Date();
            const duration = (endTime.getTime() - startTime.getTime()) / 1000;
            this.log.log(`=== SCRAPER CRON JOB COMPLETED ===`);
            this.log.log(`Duration: ${duration} seconds`);
        } catch (error) {
            this.log.error('=== SCRAPER CRON JOB FAILED ===');
            this.log.error(`Error: ${error.message}`);
            this.log.error(error.stack);
            // Don't throw - let the cron job complete even if one scraper fails
        }
    }
}
```

---

### Fix 2: Add Manual Trigger Endpoint (Already Exists)

You already have `/scraper/run-now` endpoint. Use this to:
- Test if scraping works
- Manually trigger scrapes
- Set up external cron service (see below)

---

### Fix 3: Use External Cron Service (Recommended for Free Tiers)

If your hosting platform doesn't support reliable cron jobs, use an external service:

#### Option A: EasyCron / Cron-Job.org (Free)

1. Sign up at https://cron-job.org (free)
2. Create new cron job:
   - **URL**: `https://your-backend-url.com/scraper/run-now`
   - **Schedule**: `0 16 * * *` (4 PM daily)
   - **Timezone**: Your timezone
3. Save and activate

#### Option B: GitHub Actions (Free)

Create `.github/workflows/scraper.yml`:

```yaml
name: Run Scraper

on:
  schedule:
    - cron: '0 16 * * *'  # 4 PM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scraper
        run: |
          curl -X GET https://your-backend-url.com/scraper/run-now
```

---

### Fix 4: Platform-Specific Solutions

#### Railway
- Railway keeps apps running 24/7 (even on free tier with credit)
- Cron jobs should work automatically
- Check logs: Railway Dashboard → Your Service → Logs

#### Render
- Free tier: Apps sleep after 15 min → Cron won't work
- **Solution**: Upgrade to paid ($7/month) OR use external cron service
- Paid tier: Cron jobs work normally

#### Heroku
- Use Heroku Scheduler addon (free tier available)
- Or use external cron service

---

## 🔍 How to Debug

### Step 1: Check if Cron is Running

Add a simple test cron that runs every minute:

```typescript
@Cron('* * * * *') // Every minute
async testCron() {
    this.log.log('TEST CRON EXECUTED - ' + new Date().toISOString());
}
```

Deploy and check logs. If you see this every minute, cron is working.

### Step 2: Check Application Logs

1. Go to your hosting platform's dashboard
2. Check logs around 4 PM UTC (or your configured time)
3. Look for:
   - `=== SCRAPER CRON JOB STARTED ===`
   - Any error messages
   - Application crashes/restarts

### Step 3: Verify Timezone

Add this to your `runAll()` method:

```typescript
this.log.log('Server Timezone: ' + Intl.DateTimeFormat().resolvedOptions().timeZone);
this.log.log('Current Time: ' + new Date().toISOString());
this.log.log('Local Time: ' + new Date().toString());
```

### Step 4: Test Manual Trigger

Call your manual endpoint:
```bash
curl https://your-backend-url.com/scraper/run-now
```

If this works but cron doesn't, the issue is with cron scheduling, not the scraping code.

---

## ✅ Quick Checklist

- [ ] `ScheduleModule.forRoot()` is in `app.module.ts`
- [ ] Cron decorator has timezone specified
- [ ] Application is running 24/7 (not sleeping)
- [ ] Logs show cron job execution attempts
- [ ] Manual trigger (`/scraper/run-now`) works
- [ ] Error handling is in place
- [ ] Environment variables are set correctly
- [ ] Only one instance runs cron (if multiple instances)

---

## 🚀 Recommended Production Setup

1. **Add timezone to cron**:
   ```typescript
   @Cron('0 16 * * *', { timezone: 'Europe/Skopje' })
   ```

2. **Add comprehensive logging**:
   ```typescript
   this.log.log('=== CRON STARTED ===');
   // ... code
   this.log.log('=== CRON COMPLETED ===');
   ```

3. **Add error handling**:
   ```typescript
   try { /* code */ } catch (error) { this.log.error(error); }
   ```

4. **Use external cron service** (if on free tier):
   - Set up cron-job.org to call `/scraper/run-now`
   - More reliable than in-app cron on free tiers

5. **Monitor logs**:
   - Set up alerts for cron failures
   - Check logs daily to ensure cron is running

---

## 📝 Environment Variables to Add

```bash
# Enable/disable cron (optional)
ENABLE_SCRAPER_CRON=true

# Timezone (optional, if not set in code)
TZ=Europe/Skopje
```

---

## 🆘 Still Not Working?

1. **Check hosting platform logs** around the scheduled time
2. **Test manual trigger** - does `/scraper/run-now` work?
3. **Add test cron** that runs every minute to verify cron works
4. **Check platform documentation** for cron job limitations
5. **Consider external cron service** as a workaround

---

**Need more help?** Check your hosting platform's documentation for cron job support and limitations.



