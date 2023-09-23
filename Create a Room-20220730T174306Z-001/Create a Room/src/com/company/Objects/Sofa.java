package com.company.Objects;

import com.company.Base;
import com.company.You;

public class Sofa extends Base {
    public String object = "  Sofa  ";
    public static String name = "a Sofa";
    public static int position=-10;

    public void sitOnSofa() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        }else {
            System.out.println("you sat on the sofa");
            You.sitting = true;
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionSofa=position;
        setHere(object,position);
        super.printMap(position);
    }
}
