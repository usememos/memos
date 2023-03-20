# A Beginner's Guide to Deploying Memos on Render.com

written by [AJ](https://memos.ajstephens.website/) (also a noob)

<img height="64px" src="https://raw.githubusercontent.com/usememos/memos/main/assets/logo-full.webp" alt="✍️ memos" />

[Live Demo](https://demo.usememos.com) • [Official Website](https://usememos.com) • [Source Code](https://github.com/usememos/memos)

## Who is this guide for?

Someone who...

- doesn't have much experience with self hosting
- has a minimal understanding of docker

Someone who wants...

- to use memos
- to support the memos project
- a cost effective and simple way to host it on the cloud with reliablity and persistance
- to share memos with friends

## Requirements

- Can follow instructions
- Have 7ish USD a month on a debit/credit card

## Guide

Create an account at [Render](https://dashboard.render.com/register)
![ss1](https://i.imgur.com/l3K7aqC.png)

1. Go to your dashboard

[https://dashboard.render.com/](https://dashboard.render.com/)

2. Select New Web Service

   ![ss2](https://i.imgur.com/IIDdK2y.png)

3. Scroll down to "Public Git repository"

4. Paste in the link for the public git repository for memos (https://github.com/usememos/memos) and press continue

   ![ss3](https://i.imgur.com/OXoCWoJ.png)

5. Render will pre-fill most of the fields but you will need to create a unique name for your web service

6. Adjust region if you want to

7. Don't touch the "branch", "root directory", and "environment" fields

   ![ss4](https://i.imgur.com/v7Sw3fp.png)

8. Click "enter your payment information" and do so

   ![ss5](https://i.imgur.com/paKcQFl.png)

   ![ss6](https://i.imgur.com/JdcO1HC.png)

9. Select the starter plan ($7 a month - a requirement for persistant data - render's free instances spin down when inactive and lose all data)

10. Click "Create Web Service"

![ss7](https://i.imgur.com/MHe45J4.png)

11. Wait patiently while the _magic_ happens 🤷‍♂️

![ss8](https://i.imgur.com/h1PXHHJ.png)

12. After some time (~ 6 min for me) the build will finish and you will see the web service is live

![ss9](https://i.imgur.com/msapkRw.png)

13. Now it's time to add the disk so your data won't dissappear when the webservice redeploys (redeploys happen automatically when the public repo is updated)

14. Select the "Disks" tab on the left menu and then click "Add Disk"

![ss10](https://i.imgur.com/rGeI0bv.png)

15. Name your disk (can be whatever)

16. Set the "Mount Path" to `/var/opt/memos`

17. Set the disk size (default is 10GB but 1GB is plenty and can be increased at any time)

18. Click "Save"

    ![ss11](https://i.imgur.com/Jbg7O6q.png)

19. Wait...again...while the webservice redeploys with the persistant disk

    ![ss12](https://i.imgur.com/pTzpE34.png)

20. aaaand....we're back online!

    ![ss13](https://i.imgur.com/qdsFfSa.png)

21. Time to test! We're going to make sure everything is working correctly.

22. Click the link in the top left, it should look like `https://the-name-you-chose.onrender.com` - this is your self hosted memos link!

    ![ss14](https://i.imgur.com/cgzFSIn.png)

23. Create a Username and Password (remember these) then click "Sign up as Host"

    ![ss15](https://i.imgur.com/kuRStAj.png)

24. Create a test memo then click save

    ![ss16](https://i.imgur.com/Eh2AB44.png)

25. Sign out of your self-hosted memos

    ![ss17](https://i.imgur.com/0mMb88G.png)

26. Return to your Render dashboard, click the "Manual Deploy" dropdown button and click "Deploy latest commit" and wait until the webservice is live again (This is to test that your data is persistant)

    ![ss18](https://i.imgur.com/w1N7VTb.png)

27. Once the webservice is live go back to your self-hosted memos page and sign in! (If your memos screen looks different then something went wrong)

28. Once you're logged in, verify your test memo is still there after the redeploy

    ![ss19](https://i.imgur.com/dTcEQZS.png)

    ![ss20](https://i.imgur.com/VE2lu8H.png)

## 🎉Celebrate!🎉

You did it! Enjoy using memos!

Want to learn more or need more guidance? Join the community on [telegram](https://t.me/+-_tNF1k70UU4ZTc9) and [discord](https://discord.gg/tfPJa4UmAv).
