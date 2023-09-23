package com.company.Objects;

import com.company.Base;

public class ShowKey extends Base {
    public static int position=-10;
    public static boolean showKeyPut;


    public static void unlock() {
        System.out.println("you turned the key.\n " +
                "the show case is unlocked and now it can be opened");
        ShowCase.locked=false;

    }

    public void setPosition(int position) {
        this.position = position;
    }
}
