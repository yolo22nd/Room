package com.company.Objects;

import com.company.Base;

public class Lamp extends Base {
    public static int position;
    public static String name = "a lamp";

    public static boolean lampOn = false;

    public static void turnLamp() {
        if (lampOn) {
            lampOn = false;
            System.out.println("you turned off the lamp ");
        }else {
            lampOn = true;
            System.out.println("you turned on the lamp ");
        }
    }

    public void setPosition(int position) {
        this.position = position;
    }
}
