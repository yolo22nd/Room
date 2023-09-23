package com.company.Objects;

import com.company.Base;
import com.company.You;

public class Cushion extends Base {
    public String object = "Cushion ";
    public static String name = "a Cushion";
    public static int position=-10;

    public void sitOnCushion() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        } else {
            System.out.println("you sat on the cushion");
            You.sitting = true;
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionCushion=position;
        setHere(object,position);
        super.printMap(position);
    }
}
